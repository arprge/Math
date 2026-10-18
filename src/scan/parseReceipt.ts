// OCR lines → register fields. Deterministic heuristics tuned for till
// receipts: the total, the date, the biggest heading, the priciest line item.

import type { Line } from "./engine"
import type { ItemDraft } from "../domain/repo"

export type Guess = {
  draft: Partial<ItemDraft>
  /** 0–1 confidence per field that was found; missing keys were not read. */
  conf: Partial<Record<keyof ItemDraft, number>>
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?"

const BRANDS = [
  "Apple", "Samsung", "Sony", "LG", "Bosch", "Dyson", "Philips", "Panasonic",
  "Lenovo", "Dell", "HP", "Asus", "Acer", "Microsoft", "Google", "Nintendo",
  "Canon", "Nikon", "Fujifilm", "GoPro", "DJI", "Bose", "Sonos", "JBL",
  "Sennheiser", "Garmin", "Fitbit", "Siemens", "Miele", "Hotpoint", "Beko",
  "Whirlpool", "Kenwood", "Breville", "De'Longhi", "DeLonghi", "Nespresso",
  "Sage", "Shark", "Hoover", "Vax", "Tefal", "Russell Hobbs", "Ninja",
  "KitchenAid", "Smeg", "Xiaomi", "OnePlus", "Huawei", "Logitech", "Razer",
  "Bang & Olufsen", "Marshall", "Roborock", "iRobot", "Brompton", "IKEA",
  "Herman Miller", "Indesit", "AEG", "Neff", "Haier", "Hisense", "TCL",
  "Oral-B", "Braun", "Remington", "Kindle", "Amazon", "Meta", "Valve",
]

const CATEGORIES: [string, RegExp][] = [
  ["Wearable", /\b(watch|band|fitbit|garmin|ring|tracker|earbuds?|airpods)\b/i],
  ["Appliance", /\b(fridge|freezer|wash(er|ing)|dryer|dishwasher|oven|hob|cooker|vacuum|hoover|kettle|toaster|coffee|espresso|microwave|blender|mixer|air ?fryer|dyson|bosch|miele|hotpoint|beko|nespresso|iron)\b/i],
  ["Furniture", /\b(sofa|chair|desk|table|bed|mattress|wardrobe|shelf|shelving|drawers?|ikea|cabinet)\b/i],
  ["Vehicle", /\b(bike|bicycle|e-?bike|scooter|tyres?|car|motor|brompton)\b/i],
  ["Electronics", /\b(tv|oled|qled|laptop|macbook|notebook|phone|iphone|galaxy|ipad|tablet|headphones?|speaker|camera|lens|console|monitor|playstation|xbox|switch|router|printer|kindle)\b/i],
]

const TOTAL = /\b(grand\s*total|total|amount\s*(due|paid|payable)|balance(\s*due)?|to\s*pay|summe|gesamt|betrag|montant|totale?)\b/i
const STRONG_TOTAL = /\b(grand\s*total|total\s*(to\s*pay|due|gbp|£)|amount\s*(due|payable)|balance\s*due)\b/i
const NOT_TOTAL = /sub\s*-?\s*total|\b(vat|tax|mwst|ust|tva|steuer|netto|change|tendered|cash\s*back|saving|savings|discount|points|items?|qty|tip)\b/i
const NOT_STORE = /receipt|invoice|welcome|thank|\b(vat|tax|tel|phone|fax|date|time|table|till)\b|www|http|@|\d{3,}/i
// Money: digits with exactly two decimals, never part of a date or percent.
const AMOUNT = /(?<![\d.,/:])(\d{1,3}(?:[,. ]\d{3})+|\d+)[.,](\d{2})(?![\d%]|[.,/:]\d)/g

/** OCR often spaces the decimal point ("18. 50"); stitch it back. */
const tidy = (s: string) => s.replace(/(\d)\s*([.,])\s+(\d{2})(?!\d)/g, "$1$2$3")

function amounts(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(AMOUNT)) {
    out.push(Number(m[1].replace(/[,. ]/g, "") + "." + m[2]))
  }
  return out
}

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (y < 2000 || y > new Date().getFullYear() + 1) return null
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

function findDate(s: string): string | null {
  let m = s.match(/(?<!\d)(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)/)
  if (m) return isoDate(+m[1], +m[2], +m[3])
  m = s.match(/(?<![\d.])(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?![\d])/)
  if (m) {
    // Day-first (UK) unless that reading is impossible.
    const [a, b] = [+m[1], +m[2]]
    return a <= 12 && b > 12 ? isoDate(+m[3], a, b) : isoDate(+m[3], b, a)
  }
  m = s.match(new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?[\\s.-]*${MON}[\\s,.-]*(\\d{4}|\\d{2})(?!\\d)`, "i"))
  if (m) return isoDate(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1])
  m = s.match(new RegExp(`${MON}\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})(?!\\d)`, "i"))
  if (m) return isoDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2])
  return null
}

function cleanItem(s: string): string {
  return s
    .replace(AMOUNT, " ")
    .replace(/\b(CHF|EUR|GBP|USD)\b|[£€$]/g, " ")
    .replace(/^\s*\d+\s*[x@*]\s*/i, "")
    .replace(/\s+[x@*]?\s*\d+\s*$/i, "")
    .replace(/\s(?:[aà@]|x\d+)(?=\s|$)/gi, " ")
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[^\p{L}\d"]+|[^\p{L}\d")]+$/gu, "")
}

export function parseReceipt(raw: Line[]): Guess {
  const lines = raw.map((l) => ({ ...l, text: tidy(l.text) }))
  const draft: Partial<ItemDraft> = {}
  const conf: Guess["conf"] = {}
  const all = lines.map((l) => l.text).join("\n")

  // Total: last amount on a total line (or the line after a bare "TOTAL").
  let totalIdx = -1
  let total: { v: number; c: number; strong: boolean } | null = null
  lines.forEach((l, i) => {
    if (!TOTAL.test(l.text) || NOT_TOTAL.test(l.text)) return
    const vals = amounts(l.text)
    const bare = /^\W*(grand\s*)?total\W*(gbp|eur|chf)?\W*$/i.test(l.text)
    const v = vals.length ? vals[vals.length - 1] : bare ? amounts(lines[i + 1]?.text ?? "")[0] : undefined
    if (v === undefined) return
    const strong = STRONG_TOTAL.test(l.text)
    if (!total || (strong && !total.strong) || (strong === total.strong && v > total.v)) {
      total = { v, c: 0.9 * l.conf, strong }
      totalIdx = i
    }
  })
  if (!total) {
    const vals = lines.filter((l) => !NOT_TOTAL.test(l.text)).flatMap((l) => amounts(l.text))
    if (vals.length) total = { v: Math.max(...vals), c: 0.45, strong: false }
  }
  if (total) {
    draft.price = (total as { v: number }).v
    conf.price = (total as { c: number }).c
  }

  // Date: prefer a line that says so.
  const dated = [...lines].sort((a, b) => Number(/date/i.test(b.text)) - Number(/date/i.test(a.text)))
  for (const l of dated) {
    const d = findDate(l.text)
    if (d) {
      draft.purchaseDate = d
      conf.purchaseDate = 0.9 * l.conf
      break
    }
  }

  // Store: the largest lettering in the header, before any date or money.
  const head: typeof lines = []
  for (const l of lines.slice(0, 6)) {
    if (findDate(l.text) || amounts(l.text).length) break
    head.push(l)
  }
  const names = head.filter((l) => !NOT_STORE.test(l.text) && /\p{L}{2,}/u.test(l.text))
  if (names.length) {
    const big = Math.max(...names.map((l) => l.size))
    const pick = names.filter((l) => l.size >= big * 0.85).slice(0, 2)
    draft.store = pick.map((l) => l.text.replace(/\s{2,}/g, " ").trim()).join(" ")
    conf.store = Math.min(...pick.map((l) => l.conf)) * 0.7
  }

  // Product: the priciest line item between header and total.
  const end = totalIdx >= 0 ? totalIdx : lines.length
  const items = lines
    .slice(head.length, end)
    .filter((l) => !TOTAL.test(l.text) && !NOT_TOTAL.test(l.text) && /\p{L}{3,}/u.test(l.text))
    .map((l) => ({ l, v: Math.max(0, ...amounts(l.text)), name: cleanItem(l.text) }))
    .filter((it) => it.v > 0 && (totalIdx >= 0 || it.v !== draft.price) && it.name.length >= 3)
    .sort((a, b) => b.v - a.v)
  if (items[0]) {
    draft.product = items[0].name
    conf.product = (items.length === 1 ? 0.75 : 0.55) * items[0].l.conf
    // The cover value is the item's own price, not the whole basket.
    if (draft.price !== undefined && items[0].v < draft.price) {
      draft.price = items[0].v
      conf.price = 0.7 * items[0].l.conf
    }
  }

  const serial = all.match(/\b(?:s\/?n|serial(?:\s*(?:no|number|#))?|imei|ser\.?\s*no)\b\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})/i)
  if (serial) {
    draft.serial = serial[1].toUpperCase()
    conf.serial = 0.85
  } else {
    const model = all.match(/\b(?:model|mod\.|part\s*no|sku)\b\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i)
    if (model) {
      draft.serial = model[1].toUpperCase()
      conf.serial = 0.6
    }
  }

  const warranty =
    all.match(/(\d{1,2})\s*-?\s*(year|yr|month|mo)s?\b[^\n]{0,24}(warranty|guarantee|cover)/i) ??
    all.match(/(?:warranty|guarantee)[^\n\d]{0,24}(\d{1,2})\s*-?\s*(year|yr|month|mo)/i)
  if (warranty) {
    const n = Number(warranty[1])
    draft.warrantyMonths = /^y/i.test(warranty[2]) ? n * 12 : n
    conf.warrantyMonths = 0.8
  }

  const product = draft.product ?? ""
  const brandRx = (b: string) => new RegExp(`(^|[^\\p{L}])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu")
  const brand = BRANDS.find((b) => brandRx(b).test(product)) ?? BRANDS.find((b) => brandRx(b).test(all))
  if (brand) {
    draft.brand = brand
    conf.brand = brandRx(brand).test(product) ? 0.85 : 0.5
  }

  const hay = `${product} ${brand ?? ""}`
  const category = CATEGORIES.find(([, rx]) => rx.test(hay))
  if (category) {
    draft.category = category[0]
    conf.category = 0.6
  }

  return { draft, conf }
}
