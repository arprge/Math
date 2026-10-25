/// <reference lib="webworker" />
// Receipt reader worker: owns onnxruntime, the two PP-OCRv6 models, image
// downscaling and parsing, so the main thread only ever sends a bitmap.

import detLocal from "./models/ppocrv6-tiny-det.onnx?url"
import recLocal from "./models/ppocrv6-tiny-rec.onnx?url"
import gpuWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url"
import cpuWasm from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url"
import dict from "./dict"
import { detSize, recognise, type Infer, type Raster } from "./engine"
import { parseReceipt } from "./parseReceipt"
import type { FromWorker, ToWorker } from "./ocr"

declare const self: DedicatedWorkerGlobalScope

const HF = "https://huggingface.co/PaddlePaddle"
// Same-origin first (hashed, immutable); the hub is a fallback mirror. Revisions
// are pinned so the mirrors stay byte-identical to the checksums in
// `scripts/fetch-models.mjs`.
const MODELS = {
  det: {
    urls: [detLocal, `${HF}/PP-OCRv6_tiny_det_onnx/resolve/2ba1506c0380b8f0b03dd142459aac66d4421f6c/inference.onnx`],
    bytes: 1_780_590,
  },
  rec: {
    urls: [recLocal, `${HF}/PP-OCRv6_tiny_rec_onnx/resolve/2612ab37152ae0a677521bae4e1e3d4fb4cf7c30/inference.onnx`],
    bytes: 4_462_639,
  },
}
const CACHE = "wk-ocr-v2"
const SRC_MAX = 2400

// Drop the PP-OCRv5 model cache (~12.7 MB) from returning visitors.
void self.caches?.delete("wk-ocr-v1").catch(() => {})

const post = (m: FromWorker) => self.postMessage(m)

const loaded = { det: 0, rec: 0 }
const total = MODELS.det.bytes + MODELS.rec.bytes
const report = () => post({ type: "progress", loaded: loaded.det + loaded.rec, total })

async function fetchModel(name: keyof typeof MODELS): Promise<Uint8Array> {
  const cache = await self.caches?.open(CACHE).catch(() => undefined)
  for (const url of MODELS[name].urls) {
    const key = new URL(url, self.location.href).href
    try {
      const hit = await cache?.match(key)
      const res = hit ?? (await fetch(key))
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        size += value.byteLength
        loaded[name] = Math.min(size, MODELS[name].bytes)
        report()
      }
      // Guard against LFS pointers or HTML error pages served with a 200.
      if (size < 100_000) throw new Error("Not a model file")
      const buf = new Uint8Array(size)
      let off = 0
      for (const c of chunks) {
        buf.set(c, off)
        off += c.byteLength
      }
      if (!hit) cache?.put(key, new Response(buf.slice())).catch(() => {})
      return buf
    } catch {
      loaded[name] = 0
    }
  }
  throw new Error("The receipt reader couldn't be downloaded. Check your connection and try again.")
}

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return !!(await gpu?.requestAdapter())
  } catch {
    return false
  }
}

type Engine = { infer: Infer; backend: "webgpu" | "wasm" }

async function createEngine(): Promise<Engine> {
  const [gpu, det, rec] = await Promise.all([hasWebGPU(), fetchModel("det"), fetchModel("rec")])

  const build = async (backend: Engine["backend"]): Promise<Engine> => {
    const ort = backend === "webgpu" ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web/wasm")
    ort.env.logLevel = "error"
    ort.env.wasm.wasmPaths = { wasm: backend === "webgpu" ? gpuWasm : cpuWasm }
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
    const opts = { executionProviders: [backend], graphOptimizationLevel: "all" as const, logSeverityLevel: 3 as const }
    // Sequential on purpose: the WebGPU EP rejects concurrent session creation.
    const sessions = {
      det: await ort.InferenceSession.create(det.slice(), opts),
      rec: await ort.InferenceSession.create(rec.slice(), opts),
    }
    const infer: Infer = async (model, data, dims) => {
      const s = sessions[model]
      const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", data, dims) })
      const t = out[s.outputNames[0]]
      const res = { data: t.data as Float32Array, dims: t.dims }
      t.dispose()
      return res
    }
    // Compile kernels now so the first real scan doesn't pay for it.
    await infer("det", new Float32Array(3 * 64 * 64), [1, 3, 64, 64])
    await infer("rec", new Float32Array(3 * 48 * 160), [1, 3, 48, 160])
    return { infer, backend }
  }

  if (gpu) {
    try {
      const fast = await build("webgpu")
      // If the GPU path ever fails mid-scan, switch to WASM for good.
      let cpu: Promise<Engine> | null = null
      const infer: Infer = (model, data, dims) =>
        cpu
          ? cpu.then((e) => e.infer(model, data, dims))
          : fast.infer(model, data, dims).catch((e) => {
              console.warn("[ocr] WebGPU run failed, using WASM", e)
              cpu ??= build("wasm")
              return cpu.then((c) => c.infer(model, data, dims))
            })
      return { infer, backend: "webgpu" }
    } catch (e) {
      console.warn("[ocr] WebGPU unavailable, using WASM", e)
    }
  }
  return build("wasm")
}

let engine: Promise<Engine> | null = null
function getEngine() {
  engine ??= createEngine().then(
    (e) => {
      post({ type: "ready", backend: e.backend })
      return e
    },
    (err) => {
      engine = null // let the next request retry
      throw err
    },
  )
  return engine
}

function draw(img: CanvasImageSource, w: number, h: number) {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, w, h)
  const raster: Raster = { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }
  return { canvas, raster }
}

async function scan(id: number, image: ImageBitmap) {
  const { infer, backend } = await getEngine()
  const t0 = performance.now()
  // Sharp source (≤2400px) for reading crops; the detector gets a smaller copy.
  const s = Math.min(1, SRC_MAX / Math.max(image.width, image.height))
  const { canvas, raster: src } = draw(image, Math.round(image.width * s), Math.round(image.height * s))
  image.close()
  const [dw, dh] = detSize(src.width, src.height)
  const det = draw(canvas, dw, dh).raster
  const result = await recognise(src, det, infer, dict as unknown as string[], (quads) =>
    post({ type: "regions", id, quads }),
  )
  post({
    type: "result",
    id,
    ...result,
    guess: parseReceipt(result.lines),
    ms: Math.round(performance.now() - t0),
    backend,
  })
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data
  if (m.type === "warm") {
    getEngine().catch((err: Error) => post({ type: "error", message: err.message }))
  } else {
    scan(m.id, m.image).catch((err: Error) =>
      post({ type: "error", id: m.id, message: err.message || "The receipt couldn't be read." }),
    )
  }
}
