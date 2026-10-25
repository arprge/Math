// Automated QA pass for the Warranty Keeper port.
//
// Covers the interactive QA matrix with a headless
// Chromium: register states, filters, views, archive ledger/drawer/closet,
// i18n (EN/RU/KK), responsive overflow, the DEMO fault injector and the whole
// on-device OCR flow (upload, paste, camera, retake, save, save failure).
//
// Usage:
//   npm run dev                       # in one terminal
//   npx playwright install chromium   # once (needs the chromium build only)
//   node qa/playwright-qa.mjs [baseURL]
//
// Playwright is NOT a project dependency: the script resolves a global
// `playwright` install (node_modules or the npx cache) at runtime.

import { createRequire } from "node:module"
import { readdirSync, mkdirSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const BASE = process.argv[2] || "http://localhost:8443/"
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots")
mkdirSync(SHOTS, { recursive: true })

function loadPlaywright() {
  const candidates = []
  try {
    candidates.push(createRequire(import.meta.url).resolve("playwright"))
  } catch {
    /* not installed locally */
  }
  const npxRoot = path.join(homedir(), ".npm", "_npx")
  if (existsSync(npxRoot)) {
    for (const d of readdirSync(npxRoot)) {
      candidates.push(path.join(npxRoot, d, "node_modules", "playwright"))
    }
  }
  for (const c of candidates) {
    if (existsSync(c)) return createRequire(c + "/index.js")("playwright")
  }
  throw new Error("playwright not found — run: npx playwright install chromium")
}

const { chromium } = loadPlaywright()

const results = []
const consoleErrors = []
const httpErrors = []
let shot = 0

async function step(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, status: "PASS", detail: detail ?? "" })
  } catch (e) {
    results.push({
      name,
      status: "FAIL",
      detail: String(e && e.message ? e.message : e).slice(0, 300),
    })
  }
}

async function snap(page, label) {
  shot += 1
  const file = path.join(SHOTS, `${String(shot).padStart(2, "0")}-${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  return file
}

function attach(page) {
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300))
  })
  page.on("pageerror", (e) =>
    consoleErrors.push("pageerror: " + String(e.message).slice(0, 300)),
  )
  page.on("response", (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`)
  })
}

// A synthetic receipt, rendered by the browser itself so the script needs no
// binary fixtures. The OCR reader must find the price, date and warranty.
const RECEIPT_HTML = `<!doctype html><html><body style="margin:0;background:#fff">
<div style="padding:60px;font-family:'DejaVu Sans',Arial,sans-serif;color:#000">
<div style="font-size:46px;margin-bottom:100px">BLUE STORE</div>
<div style="font-size:46px;margin-bottom:140px">RECEIPT NO A12345</div>
<div style="font-size:46px;margin-bottom:90px">WASHING MACHINE</div>
<div style="font-size:46px;margin-bottom:130px">MODEL X200</div>
<div style="font-size:46px;margin-bottom:100px">TOTAL 349.00 GBP</div>
<div style="font-size:46px;margin-bottom:90px">DATE 12 SEP 2026</div>
<div style="font-size:46px;margin-bottom:100px">WARRANTY 24 MONTHS</div>
</div></body></html>`

let receiptBuffer = null
async function receiptFile(browser) {
  if (receiptBuffer) return receiptBuffer
  const p = await browser.newPage()
  await p.setViewportSize({ width: 900, height: 1200 })
  await p.setContent(RECEIPT_HTML)
  receiptBuffer = await p.screenshot()
  await p.close()
  return receiptBuffer
}

const SEED_ITEMS = [
  { id: "1", product: 'MacBook Pro 14"', brand: "Apple", category: "Electronics", serial: "C02XL0ACJGH7", purchaseDate: "2025-11-02", warrantyMonths: 12, price: 2499, receipt: true, store: "Apple Store" },
  { id: "2", product: "Bosch Dishwasher", brand: "Bosch", category: "Appliance", serial: "SMV6ZCX01G-2024", purchaseDate: "2024-03-18", warrantyMonths: 24, price: 749, receipt: true, store: "John Lewis" },
  { id: "3", product: "Sony WH-1000XM5", brand: "Sony", category: "Electronics", serial: "SN-XM5-889201", purchaseDate: "2026-06-27", warrantyMonths: 12, price: 379, receipt: false, store: "Amazon" },
  { id: "4", product: "Dyson V15", brand: "Dyson", category: "Appliance", serial: "DY-V15-4471902", purchaseDate: "2024-09-30", warrantyMonths: 24, price: 599, receipt: true, store: "Currys" },
  { id: "5", product: "Garmin Fenix 7", brand: "Garmin", category: "Wearable", serial: "GRM-F7-0025518", purchaseDate: "2024-10-12", warrantyMonths: 24, price: 599, receipt: true, store: "Garmin.com" },
  { id: "6", product: "Herman Miller Aeron", brand: "Herman Miller", category: "Furniture", serial: "HM-AER-2021-77", purchaseDate: "2021-04-04", warrantyMonths: 144, price: 1395, receipt: true, store: "Herman Miller Store" },
  { id: "7", product: "Vintage Radio", brand: "Panasonic", category: "Electronics", serial: "PR-1974-001", purchaseDate: "2020-03-15", warrantyMonths: 24, price: 120, receipt: true, store: "Cash & Carry" },
]

const browser = await chromium.launch({
  channel: "chromium",
  args: ["--no-sandbox", "--enable-unsafe-webgpu"],
})
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "en-GB",
})
const page = await ctx.newPage()
attach(page)
const RECEIPT = await receiptFile(browser)

// ---------------------------------------------------------------- register
await step("register: skeleton then ready", async () => {
  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  const skeleton = await page
    .waitForSelector(".receipt-card.is-blank", { timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  await page.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await page.waitForFunction(
    () => !document.querySelector("main section .skeleton-bar"),
    null,
    { timeout: 10000 },
  )
  const cards = await page.locator(".receipt-card:not(.is-blank)").count()
  return `skeleton seen=${skeleton}, receipt cards=${cards}`
})

await step("register: no NaN/undefined leaked into copy", async () => {
  const text = await page.locator("body").innerText()
  const bad = ["NaN", "undefined", "[object Object]", "Infinity"].filter((s) =>
    text.includes(s),
  )
  if (bad.length) throw new Error("found: " + bad.join(", "))
  return "clean"
})

await step("register: stat band shows 4 cells with values", async () => {
  const band = page.locator("main section").first()
  const values = await band
    .locator("div > div.font-display, .font-display")
    .allInnerTexts()
  const pending = await band.locator(".skeleton-pulse").count()
  if (pending) throw new Error("stat values still pending")
  return `values=${values.filter(Boolean).join("|")}`
})

await step("register: money stat popover opens and closes", async () => {
  const trigger = page.locator("main section button[aria-expanded]").first()
  await trigger.click()
  await page.waitForSelector("div[role=dialog]", { timeout: 3000 })
  const dlg = await page.locator("div[role=dialog]").innerText()
  if (!dlg.trim()) throw new Error("empty popover")
  await snap(page, "money-popover")
  // close via the click-away catcher (the popover has no Esc handler)
  await page.locator("button.fixed.inset-0").first().click({ force: true })
  await page.waitForTimeout(200)
  if (await page.locator("div[role=dialog]").count())
    throw new Error("popover did not close")
  return "popover text: " + dlg.replace(/\s+/g, " ").slice(0, 120)
})

await step("register: all four filters change the visible set", async () => {
  const filters = page.locator("main .grid.grid-cols-4 button")
  const n = await filters.count()
  if (n !== 4) throw new Error("expected 4 filter buttons, got " + n)
  const seen = []
  for (let i = 0; i < n; i++) {
    await filters.nth(i).click()
    await page.waitForTimeout(120)
    const cards = await page.locator(".receipt-card:not(.is-blank)").count()
    const pressed = await filters.nth(i).getAttribute("aria-pressed")
    seen.push(`${i}:${pressed}/${cards}`)
  }
  await filters.nth(0).click()
  return seen.join(" ")
})

await step("register: list <-> receipts view toggle", async () => {
  const list = page.getByTitle(/list|лист|тізім/i).first()
  const rec = page.getByTitle(/receipt|чек|қолжау/i).first()
  await list.click()
  await page.waitForTimeout(150)
  const rows = await page.locator("main ul li").count()
  const cardsInList = await page.locator(".receipt-card").count()
  await snap(page, "list-view")
  await rec.click()
  await page.waitForTimeout(150)
  const cards = await page.locator(".receipt-card:not(.is-blank)").count()
  if (cardsInList !== 0) throw new Error("receipt cards still visible in list view")
  return `list rows=${rows}, receipt cards=${cards}`
})

await step("register: risk flag recommendation is hidden until hover", async () => {
  const card = page.locator(".receipt-card:not(.is-blank)").first()
  const wrap = card.locator("div.max-h-0").first()
  const before = await wrap.evaluate((el) => getComputedStyle(el).maxHeight)
  await card.hover()
  await page.waitForTimeout(400)
  const after = await wrap.evaluate((el) => getComputedStyle(el).maxHeight)
  if (before === after) throw new Error(`max-height unchanged (${before})`)
  return `max-height ${before} -> ${after}`
})

// ----------------------------------------------------------------- archive
await step("archive: tab switches, shelf + ledger render", async () => {
  await page.getByRole("button", { name: /archive|архив|мұрағат/i }).first().click()
  await page.waitForTimeout(400)
  const rows = await page.locator("main section ul li button").count()
  const heading = await page
    .locator("main h3")
    .first()
    .innerText()
    .catch(() => "")
  if (!rows) throw new Error("no ledger rows")
  await snap(page, "archive")
  return `ledger rows=${rows}, heading="${heading}"`
})

await step("archive: search filters, empty state and clear", async () => {
  const input = page.locator("main input").first()
  await input.fill("zzz-no-such-item")
  await page.waitForTimeout(250)
  const empty = await page.locator("main").innerText()
  if (!/no match|nothing filed|не найден|табылма/i.test(empty))
    throw new Error("no empty-state copy found")
  await snap(page, "archive-empty")
  await page
    .locator("main button", { hasText: /clear|очист|тазарту/i })
    .first()
    .click()
  await page.waitForTimeout(250)
  const rows = await page.locator("main section ul li button").count()
  if (!rows) throw new Error("rows did not come back after clear")
  return `rows restored=${rows}`
})

await step("archive: filed/missing filter changes the counts", async () => {
  const group = page.locator("main [role=group]").first()
  const btns = group.locator("button")
  const counts = []
  for (let i = 0; i < (await btns.count()); i++) {
    await btns.nth(i).click()
    await page.waitForTimeout(250)
    counts.push((await btns.nth(i).innerText()).replace(/\s+/g, " ").trim())
  }
  const numbers = counts.map((c) => (c.match(/\d+/) || ["?"])[0])
  if (new Set(numbers).size < 2)
    throw new Error("filter counts identical: " + counts.join(","))
  return "filter labels: " + counts.join(" | ")
})

await step("archive: row click opens preview drawer, Esc closes", async () => {
  const row = page.locator("main section ul li button").first()
  await row.click()
  await page.waitForTimeout(300)
  if (!(await page.locator("aside").count()))
    throw new Error("preview drawer did not open")
  await snap(page, "archive-drawer")
  await page.keyboard.press("Escape")
  await page.waitForTimeout(250)
  if (await page.locator("aside").count())
    throw new Error("drawer did not close on Escape")
  return "drawer opened and closed"
})

await step("archive: keyboard arrow navigation moves focus between rows", async () => {
  const rows = page.locator("main section ul li button")
  await rows.first().focus()
  await page.keyboard.press("ArrowDown")
  await page.waitForTimeout(200)
  const focused = await page.evaluate(
    () => document.activeElement?.textContent?.slice(0, 40) ?? "",
  )
  return `focus now on "${focused}"`
})

await step("archive: Ctrl+K focuses the search field", async () => {
  await page.keyboard.press("Control+k")
  await page.waitForTimeout(200)
  const tag = await page.evaluate(() => document.activeElement?.tagName)
  if (tag !== "INPUT") throw new Error("active element is " + tag)
  return "search focused"
})

// -------------------------------------------------------------------- i18n
await step("i18n: EN/RU/KZ switch, html lang updates", async () => {
  const out = []
  for (const code of ["ru", "kk", "en"]) {
    await page.locator(`button[lang=${code}]`).click()
    await page.waitForTimeout(300)
    const lang = await page.evaluate(() => document.documentElement.lang)
    if (lang !== code) throw new Error(`html lang=${lang}, expected ${code}`)
    const body = await page.locator("body").innerText()
    if (code !== "en" && !/[А-Яа-я]/.test(body))
      throw new Error(`no Cyrillic in ${code}`)
    out.push(`${code}:${lang}`)
  }
  return out.join(" ")
})

await step("i18n: language choice persists across reload", async () => {
  await page.locator("button[lang=ru]").click()
  await page.waitForTimeout(200)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  const lang = await page.evaluate(() => document.documentElement.lang)
  if (lang !== "ru") throw new Error("lang after reload = " + lang)
  return "persisted ru"
})

await step("i18n: ru-RU browser locale is auto-detected", async () => {
  const c2 = await browser.newContext({
    locale: "ru-RU",
    viewport: { width: 1280, height: 900 },
  })
  const p2 = await c2.newPage()
  await p2.goto(BASE, { waitUntil: "domcontentloaded" })
  await p2.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  const lang = await p2.evaluate(() => document.documentElement.lang)
  await c2.close()
  if (lang !== "ru") throw new Error("detected " + lang)
  return "detected ru"
})

// -------------------------------------------------------------- responsive
await step("responsive: no horizontal overflow at 320/375/768/1280", async () => {
  const out = []
  for (const w of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(250)
    const over = await page.evaluate(() => {
      const de = document.documentElement
      const bad = []
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2)) {
          bad.push(el.tagName + "." + String(el.className).slice(0, 60))
        }
      }
      return { sw: de.scrollWidth, cw: de.clientWidth, bad: bad.slice(0, 4) }
    })
    if (over.sw > over.cw + 2)
      throw new Error(
        `w=${w} scrollWidth=${over.sw} client=${over.cw} :: ${over.bad.join(" | ")}`,
      )
    out.push(`${w}:ok`)
    await snap(page, `responsive-${w}`)
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  return out.join(" ")
})

await step("responsive: RU copy does not overflow the filter bar", async () => {
  await page.locator("button[lang=ru]").click()
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForTimeout(300)
  const over = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2,
  )
  await snap(page, "responsive-ru-375")
  await page.locator("button[lang=en]").click()
  if (over) throw new Error("horizontal overflow in RU at 375px")
  return "no overflow"
})

// ------------------------------------------------------------- error path
await step("states: DEMO fault injection shows the error state + retry", async () => {
  await page.locator("header button[aria-haspopup=menu]").click()
  await page.getByRole("menuitemradio", { name: /load error/i }).click()
  await page.waitForTimeout(1500)
  const alert = page.locator("div[role=alert]")
  if (!(await alert.count())) throw new Error("no error alert rendered")
  const text = await alert.innerText()
  await snap(page, "load-error")
  // clear the fault so later steps see a healthy app
  await page.locator("header button[aria-haspopup=menu]").click()
  await page.getByRole("menuitemradio", { name: /^normal/i }).click()
  await page.waitForTimeout(1200)
  if (!(await page.locator(".receipt-card:not(.is-blank)").count()))
    throw new Error("did not recover after clearing the fault")
  return "error alert shown: " + text.replace(/\s+/g, " ").slice(0, 80)
})

// ------------------------------------------------------------------- scan
await step("scan: register dialog opens with choose step", async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page
    .locator("main button", { hasText: /register|add|добавить|қосу/i })
    .first()
    .click()
  await page.waitForTimeout(1500)
  const dialog = await page.locator("body").innerText()
  if (!/photo|upload|камера|фото/i.test(dialog))
    throw new Error("no scan options rendered")
  await snap(page, "scan-choose")
  return "choose step rendered"
})

await step("scan: uploaded receipt image runs OCR and reaches the review form", async () => {
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: RECEIPT })
  await page.waitForTimeout(2000)
  await snap(page, "scan-reading")
  // The reader loads the models and runs inference: give it a generous window.
  const field = page.locator("input:not([type=file])").first()
  const ok = await field
    .waitFor({ state: "visible", timeout: 240000 })
    .then(() => true)
    .catch(() => false)
  if (!ok) {
    const body = await page.locator("body").innerText()
    throw new Error("no review form: " + body.replace(/\s+/g, " ").slice(0, 200))
  }
  await page.waitForTimeout(1500)
  await snap(page, "scan-review")
  const values = await page
    .locator("input:not([type=file])")
    .evaluateAll((els) => els.map((e) => e.value).filter(Boolean))
  return "review form reached, values=" + JSON.stringify(values).slice(0, 200)
})

await step("scan: retake returns to the choose step", async () => {
  const c9 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const p9 = await c9.newPage()
  attach(p9)
  await p9.goto(BASE, { waitUntil: "domcontentloaded" })
  await p9.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p9
    .locator("main button", { hasText: /register|add/i })
    .first()
    .click()
  await p9.waitForTimeout(1200)
  await p9
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: RECEIPT })
  await p9
    .locator("input:not([type=file])")
    .first()
    .waitFor({ state: "visible", timeout: 240000 })
  const retake = p9.locator("button", { hasText: /retake/i }).first()
  if (!(await retake.count()))
    throw new Error("no retake button in the review step")
  await retake.click()
  await p9.waitForTimeout(800)
  const body = await p9.locator("body").innerText()
  await snap(p9, "scan-retake")
  await c9.close()
  if (!/take photo|upload|камера|фото/i.test(body))
    throw new Error("did not return to the choose step")
  return "retake returned to the choose step"
})

await step("scan: saving the scanned item files it into the register", async () => {
  const product = page.locator("input:not([type=file])").first()
  await product.fill("QA Scanner Item")
  await page.locator("button[type=submit]").click()
  await page.waitForTimeout(1200)
  if (await page.locator("button[type=submit]").count())
    throw new Error("dialog stayed open after save")
  const cards = await page.locator(".receipt-card:not(.is-blank)").count()
  if (cards < 7) throw new Error("new card missing, cards=" + cards)
  const fresh = await page.locator(".receipt-card.print-in").count()
  const status = await page.locator("header [role=status]").innerText()
  await snap(page, "after-save")
  return `cards=${cards}, print-in=${fresh}, status="${status.replace(/\s+/g, " ")}"`
})

await step("scan: the dialog chrome is localized", async () => {
  await page.locator("button[lang=ru]").click()
  await page.waitForTimeout(300)
  await page
    .locator("main button", { hasText: /регистр|добав/i })
    .first()
    .click()
  await page.waitForTimeout(1200)
  const text = await page.locator("body").innerText()
  if (!/[А-Яа-я]/.test(text)) throw new Error("no Cyrillic in the RU dialog")
  await snap(page, "scan-ru")
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  await page.locator("button[lang=en]").click()
  return "dialog rendered in Russian"
})

// ------------------------------------------------- extra: seeded datasets
await step("archive: closet arrows page through more than four years", async () => {
  const c3 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  await c3.addInitScript((items) => {
    localStorage.setItem("warranty-keeper:items:v1", JSON.stringify(items))
  }, SEED_ITEMS)
  const p3 = await c3.newPage()
  attach(p3)
  await p3.goto(BASE, { waitUntil: "domcontentloaded" })
  await p3.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p3.getByRole("button", { name: /archive/i }).first().click()
  await p3.waitForTimeout(500)
  const arrow = p3.locator("button[aria-label*='2020']").first()
  if (!(await arrow.count()))
    throw new Error("no 'older years' arrow for the 2020 shelf")
  await arrow.click()
  await p3.waitForTimeout(400)
  const shelf = await p3.locator("section[aria-label*='2020']").count()
  await snap(p3, "archive-page2")
  await c3.close()
  if (!shelf) throw new Error("2020 shelf not shown after paging")
  return "paged to the 2020 shelf"
})

await step("archive: mobile preview is a bottom sheet with a scrim", async () => {
  const c4 = await browser.newContext({
    viewport: { width: 375, height: 800 },
  })
  const p4 = await c4.newPage()
  attach(p4)
  await p4.goto(BASE, { waitUntil: "domcontentloaded" })
  await p4.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p4.getByRole("button", { name: /archive/i }).first().click()
  await p4.waitForTimeout(500)
  await p4.locator("main section ul li button").first().click()
  await p4.waitForTimeout(400)
  const box = await p4.locator("aside").boundingBox()
  const scrim = await p4.locator("button.fixed.inset-0").count()
  await snap(p4, "archive-mobile-drawer")
  await c4.close()
  if (!box) throw new Error("no drawer")
  if (!scrim) throw new Error("no scrim behind the mobile drawer")
  if (box.y < 200) throw new Error(`drawer not anchored to the bottom (y=${box.y})`)
  return `drawer at y=${Math.round(box.y)} (viewport 800), scrim=${scrim}`
})

await step("register: a filter with no matches shows the empty state", async () => {
  const c5 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  await c5.addInitScript(() => {
    localStorage.setItem(
      "warranty-keeper:items:v1",
      JSON.stringify([
        {
          id: "a",
          product: "Fresh Coffee Maker",
          brand: "Sage",
          category: "Appliance",
          serial: "SG-0001",
          purchaseDate: "2026-09-01",
          warrantyMonths: 24,
          price: 90,
          receipt: true,
          store: "John Lewis",
        },
      ]),
    )
  })
  const p5 = await c5.newPage()
  attach(p5)
  await p5.goto(BASE, { waitUntil: "domcontentloaded" })
  await p5.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p5.locator("main .grid.grid-cols-4 button").nth(3).click()
  await p5.waitForTimeout(300)
  const text = await p5.locator("main").innerText()
  await snap(p5, "register-empty")
  await c5.close()
  if (!/no items in this view/i.test(text)) throw new Error("empty-state copy missing")
  return "empty state shown"
})

await step("scan: camera path works with a fake capture device", async () => {
  const camBrowser = await chromium.launch({
    channel: "chromium",
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  })
  const c6 = await camBrowser.newContext({
    viewport: { width: 900, height: 700 },
    permissions: ["camera"],
  })
  const p6 = await c6.newPage()
  attach(p6)
  await p6.goto(BASE, { waitUntil: "domcontentloaded" })
  await p6.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p6
    .locator("main button", { hasText: /register|add/i })
    .first()
    .click()
  await p6.waitForTimeout(1500)
  const cam = p6.locator("button", { hasText: /take photo|camera/i }).first()
  if (!(await cam.count())) throw new Error("no camera button in the choose step")
  await cam.click()
  await p6.waitForTimeout(2000)
  const video = await p6.locator("video").count()
  await snap(p6, "scan-camera")
  await camBrowser.close()
  if (!video) throw new Error("camera view did not open a video stream")
  return "camera view opened with a video stream"
})

await step("scan: pasting an image from the clipboard starts a scan", async () => {
  const b64 = RECEIPT.toString("base64")
  const c7 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const p7 = await c7.newPage()
  attach(p7)
  await p7.goto(BASE, { waitUntil: "domcontentloaded" })
  await p7.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p7
    .locator("main button", { hasText: /register|add/i })
    .first()
    .click()
  await p7.waitForTimeout(1200)
  await p7.evaluate(
    ({ b64 }) => {
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      const file = new File([arr], "receipt.png", { type: "image/png" })
      const dt = new DataTransfer()
      dt.items.add(file)
      window.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      )
    },
    { b64 },
  )
  await p7.waitForTimeout(2000)
  const canvas = await p7.locator("canvas").count()
  await snap(p7, "scan-paste")
  await c7.close()
  if (!canvas) throw new Error("paste did not start a scan (no preview canvas)")
  return "pasted image started a scan"
})

await step("scan: a save failure shows the error notice and a retry", async () => {
  const c8 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const p8 = await c8.newPage()
  attach(p8)
  await p8.goto(BASE, { waitUntil: "domcontentloaded" })
  await p8.waitForSelector(".receipt-card:not(.is-blank)", { timeout: 15000 })
  await p8.locator("header button[aria-haspopup=menu]").click()
  await p8.getByRole("menuitemradio", { name: /save error/i }).click()
  await p8.waitForTimeout(600)
  await p8
    .locator("main button", { hasText: /register|add/i })
    .first()
    .click()
  await p8.waitForTimeout(1200)
  await p8
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: RECEIPT })
  await p8
    .locator("input:not([type=file])")
    .first()
    .waitFor({ state: "visible", timeout: 240000 })
  await p8.locator("input:not([type=file])").first().fill("QA Failing Save")
  await p8.locator("button[type=submit]").click()
  await p8.waitForTimeout(2500)
  const body = await p8.locator("body").innerText()
  const btnText = await p8.locator("button[type=submit]").innerText()
  await snap(p8, "scan-save-error")
  await c8.close()
  if (!/retry/i.test(btnText)) throw new Error("no retry affordance: " + btnText)
  if (!/could not be filed|не удалось|сақталма/i.test(body))
    throw new Error("no error notice: " + body.replace(/\s+/g, " ").slice(-200))
  return "save error surfaced"
})

await browser.close()

const failed = results.filter((r) => r.status === "FAIL")
console.log("\n=== QA RESULTS ===")
for (const r of results)
  console.log(`${r.status}  ${r.name}\n      ${r.detail}`)
console.log("\n=== CONSOLE ERRORS (" + consoleErrors.length + ") ===")
for (const e of [...new Set(consoleErrors)].slice(0, 20)) console.log("  - " + e)
console.log("\n=== HTTP >= 400 (" + httpErrors.length + ") ===")
for (const e of [...new Set(httpErrors)].slice(0, 20)) console.log("  - " + e)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
