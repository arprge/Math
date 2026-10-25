// Fetches the PP-OCRv6 tiny models used by the receipt scanner.
//
// The `.onnx` files are ~6.2 MB total and are intentionally NOT committed
// (see .gitignore and CLAUDE.md §4). Run this once after cloning:
//
//   npm run fetch-models            # download anything missing/invalid
//   npm run fetch-models -- --check  # verify only (exit 1 if a model is absent)
//
// Sources are the PaddlePaddle HuggingFace repos that `src/scan/ocr.worker.ts`
// also falls back to at runtime. Revisions are pinned so the checksums stay
// reproducible.

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
  },
  {
    file: "ppocrv6-tiny-rec.onnx",
    url: `${HF}/PP-OCRv6_tiny_rec_onnx/resolve/2612ab37152ae0a677521bae4e1e3d4fb4cf7c30/inference.onnx`,
    bytes: 4_462_639,
    sha256: "9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6",
  },
]

// Models from the PP-OCRv5 reader; remove them once the v6 set is verified.
const LEGACY = ["ppocrv5-mobile-det.onnx", "ppocrv5-mobile-rec-en.onnx"]

const checkOnly = process.argv.includes("--check")
const targetDir = join(ROOT, "src", "scan", "models")

const digest = (buffer) => createHash("sha256").update(buffer).digest("hex")

async function isCurrent(path, model) {
  try {
    if ((await stat(path)).size !== model.bytes) return false
  } catch {
    return false
  }
  return digest(await readFile(path)) === model.sha256
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
for (const model of MODELS) {
  const path = join(targetDir, model.file)
  if (await isCurrent(path, model)) {
    console.log(`ok       ${model.file}`)
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
}

if (failed) process.exit(1)

// The v6 pair is complete now, so stale v5 files would only be dead weight.
if (!checkOnly) {
  for (const file of LEGACY) {
    await unlink(join(targetDir, file)).catch(() => {})
  }
}
