// PP-OCRv5 pre/post-processing as pure functions over typed arrays.
// No DOM and no onnxruntime import: the worker moves tensors in and out
// through `Infer`, which keeps this file testable outside a browser.

export type Raster = {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export type Infer = (
  model: "det" | "rec",
  data: Float32Array,
  dims: number[],
) => Promise<{ data: Float32Array; dims: readonly number[] }>

type Vec = { x: number; y: number }

/** Detected text region in source pixels: centre plus its two side vectors. */
type Rect = { c: Vec; a: Vec; b: Vec }

/** A rect pinned to a reading direction: top-left corner, unit axes, size. */
type Region = { tl: Vec; u: Vec; v: Vec; w: number; h: number; c: Vec }

/** Normalised (0–1) corner coordinates: tl, tr, br, bl. */
export type Quad = [number, number, number, number, number, number, number, number]

export type Line = {
  text: string
  conf: number
  /** Median glyph height as a fraction of the image's long side. */
  size: number
}

export type OcrResult = { lines: Line[]; quads: Quad[] }

const DET_THRESH = 0.3
const BOX_THRESH = 0.6
const UNCLIP_RATIO = 1.5
const REC_H = 48
const REC_MIN_W = 160
const REC_MAX_W = 2400
const REC_BATCH = 16
const MIN_CONF = 0.5

/** Detector input size: ~1.1 MP budget so tall receipts keep readable glyphs. */
export function detSize(w: number, h: number): [number, number] {
  const s = Math.min(Math.sqrt(1_100_000 / (w * h)), 1600 / Math.max(w, h), 2)
  const snap = (n: number) => Math.max(32, Math.round((n * s) / 32) * 32)
  return [snap(w), snap(h)]
}

// Paddle feeds BGR planes with ImageNet stats applied in that order.
const DET_LUT = [0, 1, 2].map((ch) => {
  const mean = [0.485, 0.456, 0.406][ch]
  const std = [0.229, 0.224, 0.225][ch]
  return Float32Array.from({ length: 256 }, (_, v) => (v / 255 - mean) / std)
})

function detTensor({ data, width, height }: Raster): Float32Array {
  const n = width * height
  const out = new Float32Array(3 * n)
  const [lb, lg, lr] = DET_LUT
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    out[i] = lb[data[p + 2]]
    out[n + i] = lg[data[p + 1]]
    out[2 * n + i] = lr[data[p]]
  }
  return out
}

/** Convex hull (monotone chain) over interleaved [x, y] points. */
function hull(pts: number[]): Vec[] {
  const p: Vec[] = []
  for (let i = 0; i < pts.length; i += 2) p.push({ x: pts[i], y: pts[i + 1] })
  p.sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const cross = (o: Vec, a: Vec, b: Vec) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Vec[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Vec[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/** Minimum-area bounding rectangle via rotating calipers over hull edges. */
function minAreaRect(h: Vec[]) {
  let best = { area: Infinity, c: { x: 0, y: 0 }, u: { x: 1, y: 0 }, lu: 0, lv: 0 }
  for (let i = 0; i < h.length; i++) {
    const p = h[i]
    const q = h[(i + 1) % h.length]
    const len = Math.hypot(q.x - p.x, q.y - p.y)
    if (len === 0) continue
    const ux = (q.x - p.x) / len
    const uy = (q.y - p.y) / len
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (const r of h) {
      const a = r.x * ux + r.y * uy
      const b = -r.x * uy + r.y * ux
      if (a < a0) a0 = a
      if (a > a1) a1 = a
      if (b < b0) b0 = b
      if (b > b1) b1 = b
    }
    const area = (a1 - a0) * (b1 - b0)
    if (area < best.area) {
      const ma = (a0 + a1) / 2
      const mb = (b0 + b1) / 2
      best = {
        area,
        c: { x: ma * ux - mb * uy, y: ma * uy + mb * ux },
        u: { x: ux, y: uy },
        lu: a1 - a0,
        lv: b1 - b0,
      }
    }
  }
  return best
}

/** DB post-process: probability map → rotated text rects in source pixels. */
function findRects(prob: Float32Array, W: number, H: number, sx: number, sy: number): Rect[] {
  const n = W * H
  const bin = new Uint8Array(n)
  for (let i = 0; i < n; i++) bin[i] = prob[i] > DET_THRESH ? 1 : 0
  const stack = new Int32Array(n)
  const pix = new Int32Array(n)
  const rowMin = new Int32Array(H)
  const rowMax = new Int32Array(H)
  const rects: Rect[] = []
  for (let i = 0; i < n; i++) {
    if (bin[i] !== 1) continue
    bin[i] = 2
    let sp = 0
    let np = 0
    let sum = 0
    let y0 = H
    let y1 = -1
    stack[sp++] = i
    while (sp) {
      const j = stack[--sp]
      pix[np++] = j
      sum += prob[j]
      const x = j % W
      const y = (j - x) / W
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= W) continue
          const k = yy * W + xx
          if (bin[k] === 1) {
            bin[k] = 2
            stack[sp++] = k
          }
        }
      }
    }
    if (np < 6 || sum / np < BOX_THRESH) continue

    // The hull of a pixel blob equals the hull of each row's outer corners.
    rowMin.fill(W, y0, y1 + 1)
    rowMax.fill(-1, y0, y1 + 1)
    for (let k = 0; k < np; k++) {
      const x = pix[k] % W
      const y = (pix[k] - x) / W
      if (x < rowMin[y]) rowMin[y] = x
      if (x > rowMax[y]) rowMax[y] = x
    }
    const pts: number[] = []
    for (let y = y0; y <= y1; y++) {
      if (rowMax[y] < 0) continue
      const l = rowMin[y]
      const r = rowMax[y] + 1
      pts.push(l, y, r, y, l, y + 1, r, y + 1)
    }
    const box = minAreaRect(hull(pts))
    if (Math.min(box.lu, box.lv) < 3) continue

    // Unclip: grow the shrunk kernel back out by area·ratio / perimeter.
    const d = (box.lu * box.lv * UNCLIP_RATIO) / (2 * (box.lu + box.lv))
    const lu = box.lu + 2 * d
    const lv = box.lv + 2 * d
    if (Math.min(lu, lv) < 5) continue
    const { u } = box
    rects.push({
      c: { x: box.c.x * sx, y: box.c.y * sy },
      a: { x: u.x * lu * sx, y: u.y * lu * sy },
      b: { x: -u.y * lv * sx, y: u.x * lv * sy },
    })
  }
  return rects
}

// Reading directions for 0°, 90°, 180°, 270° page rotations.
const DIRS: Vec[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
]

function orient({ c, a, b }: Rect, k: number): Region {
  const r = DIRS[k]
  const down = { x: -r.y, y: r.x }
  const dot = (p: Vec, q: Vec) => p.x * q.x + p.y * q.y
  const pick = (along: Vec) => {
    const da = dot(a, along)
    const db = dot(b, along)
    return Math.abs(da) >= Math.abs(db)
      ? da >= 0 ? a : { x: -a.x, y: -a.y }
      : db >= 0 ? b : { x: -b.x, y: -b.y }
  }
  const wv = pick(r)
  const hv0 = wv === a || (wv.x === -a.x && wv.y === -a.y) ? b : a
  const hv = dot(hv0, down) >= 0 ? hv0 : { x: -hv0.x, y: -hv0.y }
  const w = Math.hypot(wv.x, wv.y)
  const h = Math.hypot(hv.x, hv.y)
  return {
    tl: { x: c.x - wv.x / 2 - hv.x / 2, y: c.y - wv.y / 2 - hv.y / 2 },
    u: { x: wv.x / w, y: wv.y / w },
    v: { x: hv.x / h, y: hv.y / h },
    w,
    h,
    c,
  }
}

const recWidth = (g: Region) =>
  Math.min(REC_MAX_W, Math.max(8, Math.round((REC_H * g.w) / g.h / 8) * 8))

/** Bilinear crop of each region into one padded BGR batch, values in [-1, 1]. */
function recTensor(src: Raster, regions: Region[], bw: number): Float32Array {
  const { data, width: W, height: H } = src
  const plane = REC_H * bw
  const out = new Float32Array(regions.length * 3 * plane)
  regions.forEach((g, bi) => {
    const ow = recWidth(g)
    const base = bi * 3 * plane
    const kx = g.w / ow
    const ky = g.h / REC_H
    for (let oy = 0; oy < REC_H; oy++) {
      const fy = (oy + 0.5) * ky
      for (let ox = 0; ox < ow; ox++) {
        const fx = (ox + 0.5) * kx
        let x = g.tl.x + g.u.x * fx + g.v.x * fy - 0.5
        let y = g.tl.y + g.u.y * fx + g.v.y * fy - 0.5
        x = x < 0 ? 0 : x > W - 1 ? W - 1 : x
        y = y < 0 ? 0 : y > H - 1 ? H - 1 : y
        const x0 = x | 0
        const y0 = y | 0
        const x1 = x0 + 1 < W ? x0 + 1 : x0
        const y1 = y0 + 1 < H ? y0 + 1 : y0
        const tx = x - x0
        const ty = y - y0
        const p00 = (y0 * W + x0) * 4
        const p10 = (y0 * W + x1) * 4
        const p01 = (y1 * W + x0) * 4
        const p11 = (y1 * W + x1) * 4
        const o = base + oy * bw + ox
        for (let ch = 0; ch < 3; ch++) {
          const s = 2 - ch // RGBA → BGR plane order
          const top = data[p00 + s] + (data[p10 + s] - data[p00 + s]) * tx
          const bot = data[p01 + s] + (data[p11 + s] - data[p01 + s]) * tx
          out[o + ch * plane] = (top + (bot - top) * ty) / 127.5 - 1
        }
      }
    }
  })
  return out
}

type Read = { text: string; conf: number }

async function readRegions(src: Raster, regions: Region[], infer: Infer, dict: string[]): Promise<Read[]> {
  const reads: Read[] = new Array(regions.length)
  const order = regions.map((g, i) => i).sort((i, j) => recWidth(regions[i]) - recWidth(regions[j]))
  // Batch similar widths together so one long line doesn't pad the rest.
  const batches: number[][] = []
  for (const i of order) {
    const cur = batches[batches.length - 1]
    const w = recWidth(regions[i])
    if (cur && cur.length < REC_BATCH && w <= Math.max(REC_MIN_W, recWidth(regions[cur[0]]) * 1.5)) cur.push(i)
    else batches.push([i])
  }
  for (const idx of batches) {
    const batch = idx.map((i) => regions[i])
    const bw = Math.max(REC_MIN_W, ...batch.map(recWidth))
    const res = await infer("rec", recTensor(src, batch, bw), [batch.length, 3, REC_H, bw])
    const [, T, C] = res.dims
    batch.forEach((g, bi) => {
      // Decode only the timesteps that cover real pixels, not the padding.
      const steps = Math.min(T, Math.ceil((recWidth(g) / bw) * T) + 1)
      let text = ""
      let sum = 0
      let count = 0
      let prev = -1
      for (let t = 0; t < steps; t++) {
        const off = (bi * T + t) * C
        let best = 0
        let bp = res.data[off]
        for (let c = 1; c < C; c++) {
          const p = res.data[off + c]
          if (p > bp) {
            bp = p
            best = c
          }
        }
        if (best !== 0 && best !== prev) {
          text += best <= dict.length ? dict[best - 1] : " "
          sum += bp
          count++
        }
        prev = best
      }
      reads[idx[bi]] = { text: text.trim(), conf: count ? sum / count : 0 }
    })
  }
  return reads
}

function quadOf(g: Region, W: number, H: number): Quad {
  const { tl, u, v, w, h } = g
  const tr = { x: tl.x + u.x * w, y: tl.y + u.y * w }
  const bl = { x: tl.x + v.x * h, y: tl.y + v.y * h }
  const br = { x: tr.x + v.x * h, y: tr.y + v.y * h }
  return [tl.x / W, tl.y / H, tr.x / W, tr.y / H, br.x / W, br.y / H, bl.x / W, bl.y / H]
}

/** Merge words that share a baseline into reading-order lines. */
function toLines(regions: Region[], reads: Read[], longSide: number): Line[] {
  // Group along the measured text direction so skewed photos still line up.
  let sx = 0
  let sy = 0
  for (const g of regions) {
    sx += g.u.x * g.w
    sy += g.u.y * g.w
  }
  const len = Math.hypot(sx, sy) || 1
  const r = { x: sx / len, y: sy / len }
  const down = { x: -r.y, y: r.x }
  const words = regions
    .map((g, i) => ({
      ...reads[i],
      h: g.h,
      y: g.c.x * down.x + g.c.y * down.y,
      x0: g.c.x * r.x + g.c.y * r.y - g.w / 2,
      x1: g.c.x * r.x + g.c.y * r.y + g.w / 2,
    }))
    .filter((w) => w.text && w.conf >= MIN_CONF)
    .sort((p, q) => p.y - q.y)

  const rows: (typeof words)[] = []
  for (const w of words) {
    const row = rows[rows.length - 1]
    const ref = row?.[0]
    if (ref && Math.abs(w.y - ref.y) < 0.5 * Math.min(w.h, ref.h)) row.push(w)
    else rows.push([w])
  }
  return rows.map((row) => {
    row.sort((p, q) => p.x0 - q.x0)
    let text = row[0].text
    for (let i = 1; i < row.length; i++) {
      // A wide gap marks a column break; the parser keys off double spaces.
      text += row[i].x0 - row[i - 1].x1 > row[i].h * 1.2 ? "  " : " "
      text += row[i].text
    }
    const chars = row.reduce((n, w) => n + w.text.length, 0)
    const hs = row.map((w) => w.h).sort((p, q) => p - q)
    return {
      text,
      conf: row.reduce((n, w) => n + w.conf * w.text.length, 0) / chars,
      size: hs[hs.length >> 1] / longSide,
    }
  })
}

/**
 * Full pass: detect on the small raster, read crops from the sharp source.
 * `onRegions` fires between the two stages so the UI can show progress.
 */
export async function recognise(
  src: Raster,
  det: Raster,
  infer: Infer,
  dict: string[],
  onRegions?: (quads: Quad[]) => void,
): Promise<OcrResult> {
  const prob = await infer("det", detTensor(det), [1, 3, det.height, det.width])
  const rects = findRects(prob.data, det.width, det.height, src.width / det.width, src.height / det.height)
  if (!rects.length) return { lines: [], quads: [] }

  // Page orientation: pick the axis most text runs along, then settle the
  // 180° ambiguity by reading the longest few lines both ways.
  let horiz = 0
  for (const { a, b } of rects) {
    const long = Math.hypot(a.x, a.y) >= Math.hypot(b.x, b.y) ? a : b
    horiz += Math.abs(long.x) >= Math.abs(long.y) ? 1 : -1
  }
  const candidates = horiz >= 0 ? [0, 2] : [1, 3]
  const quads = rects.map((rc) => quadOf(orient(rc, candidates[0]), src.width, src.height))
  onRegions?.(quads)

  const area = (rc: Rect) => Math.hypot(rc.a.x, rc.a.y) * Math.hypot(rc.b.x, rc.b.y)
  const sample = [...rects].sort((p, q) => area(q) - area(p)).slice(0, 6)
  const score = (rs: Read[]) => rs.reduce((n, r) => n + r.conf * r.text.length, 0)

  let k = candidates[0]
  let known = await readRegions(src, sample.map((rc) => orient(rc, k)), infer, dict)
  const firstMean = known.reduce((n, r) => n + r.conf, 0) / known.length
  if (firstMean < 0.9) {
    const alt = await readRegions(src, sample.map((rc) => orient(rc, candidates[1])), infer, dict)
    if (score(alt) > score(known)) {
      k = candidates[1]
      known = alt
    }
  }

  // Reuse the sample reads; only the remaining regions go back to the model.
  const regions = rects.map((rc) => orient(rc, k))
  const done = new Map(sample.map((rc, i) => [rc, known[i]]))
  const todo = rects.filter((rc) => !done.has(rc))
  const rest = await readRegions(src, todo.map((rc) => orient(rc, k)), infer, dict)
  todo.forEach((rc, i) => done.set(rc, rest[i]))
  const reads = rects.map((rc) => done.get(rc)!)
  return {
    lines: toLines(regions, reads, Math.max(src.width, src.height)),
    quads: regions.map((g) => quadOf(g, src.width, src.height)),
  }
}
