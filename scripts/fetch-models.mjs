// Fetches and packs the PP-OCRv6 tiny models used by the receipt scanner.
//
// The `.onnx` files are intentionally NOT committed (see .gitignore and
// CLAUDE.md §4). Run this once after cloning:
//
//   npm run fetch-models            # download, then prune + int8-pack if possible
//   npm run fetch-models -- --pack  # fail if the Python packer is unavailable
//   npm run fetch-models -- --check # verify only (exit 1 if a model is absent)
//
// Packing (`scripts/quantize-models.py`) drops the 6 289 unused classifier
// classes and stores Conv/MatMul weights as int8: 6.24 MB -> 1.18 MB, same
// decoded text and slightly faster inference. Without Python + onnx the
// float32 models still work, they are just larger; use --pack in CI.
//
// Sources are the PaddlePaddle HuggingFace repos that `src/scan/ocr.worker.ts`
// also falls back to at runtime. Revisions are pinned so the checksums stay
// reproducible.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const HF = "https://huggingface.co/PaddlePaddle"

const MODELS = [
  {
    file: "ppocrv6-tiny-det.onnx",
    url: `${HF}/PP-OCRv6_tiny_det_onnx/resolve/2ba1506c0380b8f0b03dd142459aac66d4421f6c/inference.onnx`,
    bytes: 1_780_590,
    sha256: "193bab7a04fca699a6c82e6abb5b81bdb28177f0abd4062552b04908dafb19f8",
    packed: { bytes: 511_234, sha256: "8970864b9cb4c1032878f48abd57922e722a24abda2e26c6a5d47c402735c41b" },
  },
  {
    file: "ppocrv6-tiny-rec.onnx",
    url: `${HF}/PP-OCRv6_tiny_rec_onnx/resolve/2612ab37152ae0a677521bae4e1e3d4fb4cf7c30/inference.onnx`,
    bytes: 4_462_639,
    sha256: "9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6",
    packed: { bytes: 664_017, sha256: "e0d206cd3a8d2dc3511cd84118f2bd8e5fb1a3ea6bfcf98e53c19a7fdb784f77" },
  },
]

// Models from the PP-OCRv5 reader; remove them once the v6 set is verified.
const LEGACY = ["ppocrv5-mobile-det.onnx", "ppocrv5-mobile-rec-en.onnx"]

const args = new Set(process.argv.slice(2))
const checkOnly = args.has("--check")
const requirePacked = args.has("--pack")
const targetDir = join(ROOT, "src", "scan", "models")

const digest = (buffer) => createHash("sha256").update(buffer).digest("hex")

/** "packed" (pruned + int8), "float" (upstream fp32) or "missing". */
async function state(path, model) {
  try {
    const { size } = await stat(path)
    if (size === model.packed.bytes && digest(await readFile(path)) === model.packed.sha256) {
      return "packed"
    }
    if (size === model.bytes && digest(await readFile(path)) === model.sha256) {
      return "float"
    }
  } catch {
    // fall through
  }
  return "missing"
}

async function download(model) {
  const path = join(targetDir, model.file)
  const response = await fetch(model.url, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${model.url}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength !== model.bytes) {
    throw new Error(
      `size mismatch for ${model.file}: got ${buffer.byteLength}, expected ${model.bytes}`,
    )
  }
  if (digest(buffer) !== model.sha256) {
    throw new Error(`sha256 mismatch for ${model.file}`)
  }

  const tmp = `${path}.download`
  await writeFile(tmp, buffer)
  await rename(tmp, path)
  return path
}

await mkdir(targetDir, { recursive: true })

let failed = false
let needsPacking = false

for (const model of MODELS) {
  const path = join(targetDir, model.file)
  const current = await state(path, model)

  if (current === "packed") {
    console.log(`ok       ${model.file}`)
    continue
  }
  if (current === "float") {
    if (checkOnly && requirePacked) {
      console.error(`float    ${model.file} — run: npm run fetch-models -- --pack`)
      failed = true
    } else if (checkOnly) {
      console.log(`float    ${model.file} (works, but 5x larger)`)
    } else {
      needsPacking = true
    }
    continue
  }

  if (checkOnly) {
    console.error(`missing  ${model.file} — run: npm run fetch-models`)
    failed = true
    continue
  }

  process.stdout.write(`fetching ${model.file} … `)
  await download(model)
  console.log("done")
  needsPacking = true
}

if (failed) process.exit(1)

if (!checkOnly && needsPacking) {
  const script = join(ROOT, "scripts", "quantize-models.py")
  const run = spawnSync("python3", [script], { stdio: "inherit" })
  if (run.status !== 0) {
    const hint = "pip install onnx==1.23.2 numpy==2.5.4"
    if (requirePacked) {
      console.error(`Packing failed. ${hint}`)
      process.exit(1)
    }
    console.warn(`\nwarning: could not pack the models (${hint}).`)
    console.warn("warning: the float32 models work, but the first scan downloads 5x more data.\n")
  }

  for (const model of MODELS) {
    if (await state(join(targetDir, model.file), model) !== "packed") {
      if (requirePacked) {
        console.error(`not packed: ${model.file}`)
        process.exit(1)
      }
    }
  }
}

// The v6 pair is complete now, so stale v5 files would only be dead weight.
if (!checkOnly) {
  for (const file of LEGACY) {
    await unlink(join(targetDir, file)).catch(() => {})
  }
}
