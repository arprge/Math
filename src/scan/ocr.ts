// Main-thread client for the receipt reader worker. Nothing heavy is loaded
// until `warmReader()` or `scanReceipt()` is first called.

import type { Line, Quad } from "./engine"
import type { Guess } from "./parseReceipt"

export type Backend = "webgpu" | "wasm"
export type ScanResult = {
  lines: Line[]
  quads: Quad[]
  guess: Guess
  ms: number
  backend: Backend
}

export type ToWorker = { type: "warm" } | { type: "scan"; id: number; image: ImageBitmap }
export type FromWorker =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; backend: Backend }
  | { type: "regions"; id: number; quads: Quad[] }
  | ({ type: "result"; id: number } & ScanResult)
  | { type: "error"; id?: number; message: string }

export type ReaderStatus =
  | { state: "idle" }
  | { state: "loading"; progress: number }
  | { state: "ready"; backend: Backend }
  | { state: "error"; message: string }

let worker: Worker | null = null
let status: ReaderStatus = { state: "idle" }
let seq = 0
const subscribers = new Set<() => void>()
const pending = new Map<number, (m: FromWorker) => void>()

function setStatus(next: ReaderStatus) {
  status = next
  subscribers.forEach((fn) => fn())
}

function boot(): Worker {
  if (worker) return worker
  const w = new Worker(new URL("./ocr.worker.ts", import.meta.url), { type: "module", name: "receipt-reader" })
  w.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data
    if (m.type === "progress") setStatus({ state: "loading", progress: m.total ? m.loaded / m.total : 0 })
    else if (m.type === "ready") setStatus({ state: "ready", backend: m.backend })
    else if (m.type === "error" && m.id === undefined) setStatus({ state: "error", message: m.message })
    if ("id" in m && m.id !== undefined) pending.get(m.id)?.(m)
  }
  w.onerror = () => {
    // A crashed worker can't recover; drop it so the next call starts fresh.
    const message = "The receipt reader stopped unexpectedly."
    pending.forEach((fn, id) => fn({ type: "error", id, message }))
    pending.clear()
    w.terminate()
    worker = null
    setStatus({ state: "error", message })
  }
  worker = w
  setStatus({ state: "loading", progress: 0 })
  w.postMessage({ type: "warm" } satisfies ToWorker)
  return w
}

/**
 * Start downloading and compiling the reader. `speculative` warms (hover,
 * focus) are skipped when the user has asked the browser to save data.
 */
export function warmReader(opts?: { speculative?: boolean }) {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  if (opts?.speculative && saveData) return
  if (status.state === "error") {
    worker?.terminate()
    worker = null
  }
  boot()
}

export const subscribeReader = (fn: () => void) => {
  subscribers.add(fn)
  return () => void subscribers.delete(fn)
}
export const readerStatus = () => status

/** Read a receipt. The bitmap is transferred (and closed) by the worker. */
export function scanReceipt(image: ImageBitmap, onRegions?: (quads: Quad[]) => void): Promise<ScanResult> {
  if (status.state === "error") warmReader()
  const w = boot()
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, (m) => {
      if (m.type === "regions") return onRegions?.(m.quads)
      pending.delete(id)
      if (m.type === "result") {
        const { type: _t, id: _i, ...result } = m
        resolve(result)
      } else if (m.type === "error") {
        reject(new Error(m.message))
      }
    })
    w.postMessage({ type: "scan", id, image } satisfies ToWorker, [image])
  })
}
