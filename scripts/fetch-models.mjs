// Fetches the PP-OCRv5 models used by the receipt scanner.
//
// The `.onnx` files are ~12.7 MB total and are intentionally NOT committed
// (see .gitignore and CLAUDE.md §4). Run this once after cloning:
//
//   npm run fetch-models            # download anything missing/invalid
//   npm run fetch-models -- --check  # verify only (exit 1 if a model is absent)
//
// Sources are the PaddlePaddle HuggingFace repos that `src/scan/ocr.worker.ts`
// also falls back to at runtime.

import { createHash } from "node:crypto"
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const HF = "https://huggingface.co/PaddlePaddle"

const MODELS = [
  {
    file: "ppocrv5-mobile-det.onnx",
    url: `${HF}/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx`,
    bytes: 4_826_518,
    sha256: "a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d",
  },
  {
    file: "ppocrv5-mobile-rec-en.onnx",
    url: `${HF}/en_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx`,
    bytes: 7_848_423,
    sha256: "b5f833dfc5d0eb71da397b4efa06ebeee9b431b690a47d6af40d77d8eabc557f",
  },
]

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
