# agents-figma.md — Port plan: align local codebase with the upstream Figma Make


> Status: **All phases complete (1–7)** — the local repo mirrors the upstream Figma Make
> app: design tokens/animations, async repository, three-language i18n (EN/RU/KK),
> slim `App` shell + extracted `src/components/` and `src/pages/`, the Receipt Archive,
> and the full on-device OCR scanner (PP-OCRv5 via `onnxruntime-web`, WebGPU with WASM
> fallback, models vendored). The legacy `monthlyRiskStats` module/export was deleted.
> Verified with `npx tsc --noEmit` (clean), `npm run build` (clean, both `.onnx` models
> emitted), and a `npm run dev` smoke test (metadata + `robots.txt` middleware work).
> Remaining: none — future work is upstream drift only.
- ## Update "Status" line above each time you complete task so other agents will know where we left off
> Canonical action target is the local repo `/home/nkaet/Documents/University/Projects/Math`.
> Upstream source of truth: Figma Make `Warranty-tracker-app`
> (`https://www.figma.com/make/csyBeQ21GnrycKRpxlwV47/Warranty-tracker-app`).

---

## 0. TL;DR

The local repo is an **older export** of the same Figma Make app. The upstream has
since grown into a materially larger app: an **async repository layer**, **three-language
i18n (EN/RU/KK)**, a second **Receipt Archive** page, **async load/save states**, and a full
**on-device OCR receipt scanner** (PaddleOCR PP-OCRv5 via `onnxruntime-web` in a Web Worker,
WebGPU with WASM fallback).

Plan: **port the upstream architecture and design faithfully in phases**, then treat OCR as a
separate, optional “performance/experimental” track — adopt the upstream OCR pipeline as the
baseline, and only deviate (multilingual rec model, WebNN, fp16/int8, precache) **if needed**.

We are **not** inventing a new design: upstream *is* the design. The job is to bring the local
code to parity with it, adapted to this repo’s conventions.

**Confirmed decisions (this revision):**
- **D1 — Fidelity: port + refactor.** Match upstream behavior/design, but **extract the inline
  components into `src/components/`** and split the register page into `src/pages/Register.tsx`
  (symmetric with `Archive.tsx`). See §3.1 for the mapping.
- **D2 — i18n: all three languages** (EN + RU + KK).
- **D3 — OCR: port the upstream baseline first**; upgrades (§6) only if needed.

---

## 1. How the upstream was read (for repeatability)

Figma Make files are **not** design files, so `get_design_context` / `get_metadata` behave
differently:

- `tools.figma.get_design_context({ fileKey: "csyBeQ21GnrycKRpxlwV47", nodeId: "0:1" })`
  returns a manifest of `file://figma/make/source/<fileKey>/<path>` links (38 source files +
  182 images). Models/build config are **not** design nodes — this is a code export.
- Each source file is fetched as an MCP resource via the `make-source-file` template:
  `file://figma/make/source/{file_key}/{+file_path}`
  (use `tools.opencode.read_mcp_resource`, or the Figma MCP `resources/read` fallback).
- Images use `file://figma/make/image/{file_key}/{hash}.png`.

**Rule for agents:** never hand-write a “lookalike”. Always read the exact upstream file first
and port it. Where the file is binary (the `.onnx` models), fetch the resource as a blob or
pull the same model from its HuggingFace source (see §6).

---

## 2. Parity matrix (local today → upstream)

| Area | Local (`/Math`) | Upstream (`figma/make`) | Action |
|---|---|---|---|
| `package.json` | react, react-dom, tailwind, vite | **+ `onnxruntime-web ^1.30.0`** | add dep |
| `vite.config.ts` | 4 Figma plugins **defined but not registered**; no worker config | plugins **registered**; `worker.format:'es'`; `optimizeDeps.exclude:['onnxruntime-web']`; imports `.figma/make/site.json` | rewrite |
| `.figma/make/site.json` | absent | present (description, robots noindex) | add |
| `src/index.css` | 148 lines: tokens + receipt classes | **299 lines**: + `soft-raised/key/pressed`, `archive-slip`, `skeleton-pulse/bar`, `print-in`, `meta-in`, `scan-sweep`, `quad-in`, `shutter-flash`, reduced-motion; **+ Inter Tight font** | replace |
| `src/domain/warranty.ts` | 82 lines | **+ `MonthGroup` + `groupByMonth()`** | extend |
| `src/domain/repo.ts` | **absent** | async localStorage repo, `ItemDraft`, `RepoError`, fault injection | add |
| `src/lib/format.ts` | `gbp/fmtDate/humanLeft` (English) | `money`, locale `fmtDate`, `humanLeft(days, Units)`, `warrantyLength` | rewrite |
| `src/stats/` | incl. `monthlyRiskStats.ts` | **no `monthlyRiskStats`**; index exports only price + risk | delete monthlyRisk |
| `src/i18n/` | **absent** | provider + `LanguageSwitcher` + `dict/{en,ru,kk}.ts` (~150 keys) | add |
| `src/App.tsx` | 878 lines, all-inline, sync seed state | 908 lines: i18n, async load states, header tabs, language switcher, lazy `RegisterDialog`, `print-in`, `StateDemo` | rewrite |
| `src/pages/Archive.tsx` | **absent** | 740 lines: shelf/box SVG, ledger, preview drawer, search/filter, keyboard nav | add |
| `src/scan/` | **absent** | engine, ocr, ocr.worker, parseReceipt, dict, RegisterDialog, **2 × .onnx** | add (optional) |
| `src/dev/StateDemo.tsx` | **absent** | fault-injection dev menu (marked `DEMO`) | add |
| `src/main.tsx` | bare `<App/>` | wrapped in `<I18nProvider>` | edit |
| `CLAUDE.md` (this repo) | written for old state | — | update after port |

---

## 3. Target architecture

```
src/
├─ main.tsx                 # <I18nProvider><App/></I18nProvider>
├─ App.tsx                  # slim shell: shared state + page switch + footer + lazy dialog
├─ index.css                # tokens + component classes + all animations
├─ components/              # NEW: extracted UI (was inline in App.tsx)
│  ├─ Header.tsx            # wordmark + REGISTER·ARCHIVE tabs + meta + LanguageSwitcher
│  ├─ Footer.tsx
│  ├─ Stat.tsx
│  ├─ MoneyStat.tsx         # value-covered cell + breakdown popover
│  ├─ StatusDot.tsx
│  ├─ ProgressLeft.tsx
│  ├─ ReceiptCard.tsx
│  ├─ RiskFlag.tsx
│  ├─ RegisterSkeleton.tsx  # blank receipts / ledger lines
│  └─ RegisterError.tsx     # voided-slip error + retry
├─ pages/
│  ├─ Register.tsx          # NEW: RegisterPage (extracted from App.tsx)
│  └─ Archive.tsx           # NEW: ArchivePage (shelves/boxes + ledger + drawer)
├─ domain/
│  ├─ warranty.ts           # + groupByMonth, MonthGroup
│  ├─ seed.ts               # unchanged
│  └─ repo.ts               # NEW: async localStorage repo + fault hooks
├─ lib/
│  ├─ format.ts             # locale-aware formatters (money/date/left/warranty)
│  └─ barcode.ts            # NEW: barcodesFrom(serial) (was inline in App.tsx)
├─ stats/                   # priceCoverStat, warrantyRiskStat, context, types (no monthlyRisk)
├─ i18n/
│  ├─ index.tsx             # I18nProvider, useI18n, t(), fmt.*, plural via Intl.PluralRules
│  ├─ LanguageSwitcher.tsx
│  └─ dict/{en,ru,kk}.ts    # en defines Dict; ru/kk `satisfies Dict`
├─ scan/                    # NEW (optional): on-device OCR
│  ├─ engine.ts             # pure PP-OCRv5 pre/post (no DOM, no ORT)
│  ├─ ocr.ts                # main-thread worker client + status store
│  ├─ ocr.worker.ts         # ORT sessions, WebGPU→WASM, model fetch+cache
│  ├─ parseReceipt.ts       # OCR lines → ItemDraft heuristics + conf
│  ├─ dict.ts               # en rec charset
│  ├─ RegisterDialog.tsx    # scan → review form; camera; drag/paste
│  └─ models/{det,rec}.onnx
└─ dev/StateDemo.tsx        # NEW: injected loading/error states
```

**Layering invariants to preserve:** `domain/` and `stats/` stay React-free; `lib/` is
presentation-only with no domain logic; display strings live in `i18n` dictionaries, **not** in
domain/stats (keep `WarrantyRisk.recommendation` as an English fallback only).

### 3.1 Component extraction map (upstream `App.tsx` → local files)

This is the **only deviation from a byte-for-byte port**. Behavior and markup stay identical;
only module boundaries change.

| Upstream symbol (in `App.tsx`) | New home | Notes |
|---|---|---|
| `App` (default) | `src/App.tsx` | Slim shell: i18n, load state, `page`, `filter`, `viewMode`, `adding`, `printed`, stats memos, footer mount, lazy dialog mount |
| register `<main>` body | `src/pages/Register.tsx` (`RegisterPage`) | Props: `items`, `ready`, `load`, `counts`, `covered`, `priceStats`, `visible`, `riskByItemId`, `printed`, `filter`, `setFilter`, `viewMode`, `setViewMode`, `onAdd`/`onRegister`, `onRetry` — or keep these in `App` and pass down a small view-model |
| `Stat` | `src/components/Stat.tsx` | — |
| `MoneyStat` | `src/components/MoneyStat.tsx` | keep torn-edge inline SVG verbatim |
| `StatusDot` | `src/components/StatusDot.tsx` | **reuse in `Archive.tsx`** (drop its local `dotColor`, or derive from `StatusDot`) |
| `ProgressLeft` | `src/components/ProgressLeft.tsx` | — |
| `ReceiptCard` | `src/components/ReceiptCard.tsx` | keep perf strips, barcode, `print-in`, `fresh` |
| `RiskFlag` | `src/components/RiskFlag.tsx` | i18n `risk.{level}.label|rec` |
| `RegisterSkeleton` | `src/components/RegisterSkeleton.tsx` | — |
| `RegisterError` | `src/components/RegisterError.tsx` | — |
| header `<header>` block | `src/components/Header.tsx` | props: `page`, `setPage`, `items.length`, `meta`, `<StateDemo/>`, `<LanguageSwitcher/>` |
| footer `<footer>` block | `src/components/Footer.tsx` | — |
| `barcodesFrom` | `src/lib/barcode.ts` | pure helper |

**Rules:** default-export one component per file; import via **relative paths** (repo style; the
`@/` alias exists but is unused — either is fine, but be consistent). Keep class strings and SVG
paths **byte-identical** to upstream while moving them. Do **not** introduce a component library,
`clsx`, or barrel files unless asked.

---

## 4. Decisions to make (recommended defaults)

| # | Decision | Chosen | Why |
|---|---|---|---|
| D1 | Fidelity vs. rewrite | **Port + refactor into `components/`** (§3.1) | Match design exactly, but split App.tsx into focused files |
| D2 | i18n scope | **EN + RU + KK** (as upstream) | Design includes the switcher; RU/KK files already exist upstream |
| D3 | OCR scope | **Port upstream baseline now**; upgrades only if needed (§6) | Upstream stack is already fast and offline-capable |
| D4 | Vendor models? | **Downloaded into `src/scan/models/` locally, gitignored**; `npm run fetch-models` restores them | Reproducible builds without 12.7 MB of binaries in git; HF fallback already coded |
| D5 | `monthlyRiskStats` | **Remove** (UI + module) | Upstream dropped the monthly band |
| D6 | `StateDemo` / `dev/` | **Port, marked `DEMO`** | Cheap; makes async states verifiable |
| D7 | Version control | **`git init` + branch before porting** | Repo is not a git repo → no safety net |

---

## 5. Phased implementation plan

### ✅ Phase 1 — Foundations (no UI change yet)
Files: `src/index.css`, `src/domain/warranty.ts`, `src/domain/repo.ts`, `src/lib/format.ts`,
`src/stats/*`, `.figma/make/site.json`.
- Replace `index.css` with the upstream 299-line version. Keep every existing token; add
  `--font-display: 'Archivo','Inter Tight',sans-serif` + the Inter Tight `@import`; add the new
  component classes/animations. **This is the design-token delta — do not invent new colors.**
- Add `MonthGroup` + `groupByMonth(enriched)` to `domain/warranty.ts` (newest month first,
  label `SEPTEMBER 2026`-style, key `YYYY-MM`).
- Add `domain/repo.ts` verbatim semantics: `loadItems()`, `saveItem(draft)`, `ItemDraft`,
  `RepoError{code}`, `faultSource`, `?fail=load|save` dev toggle, ~650/550 ms simulated latency.
- Rewrite `lib/format.ts` to the locale-aware API (`money`, `fmtDate(d, locale, monthsShort)`,
  `humanLeft(days, Units)`, `warrantyLength`). Callers will use `fmt.*` from i18n.
- Stats: delete `src/stats/monthlyRiskStats.ts`; drop its export from `stats/index.ts`;
  keep `priceStats`/`riskStats`/`context`/`types` (upstream is essentially identical).
- Add `.figma/make/site.json` (upstream content).

### ✅ Phase 2 — i18n
Files: `src/i18n/index.tsx`, `src/i18n/LanguageSwitcher.tsx`, `src/i18n/dict/{en,ru,kk}.ts`,
`src/main.tsx`.
- Port the `I18nProvider`/`useI18n`/`t()`/`fmt.*` design exactly: dotted-key lookup,
  `{name}` interpolation, `Intl.PluralRules` plurals via `{one,few,many,other}`, `Key<Dict>`
  dotted-key typing, `satisfies Dict` on ru/kk (missing key = type error).
- `LOCALE = { en:'en-GB', ru:'ru-RU', kk:'kk-KZ' }`; persist to
  `localStorage['warranty-keeper:lang']`; detect from `navigator.language`; set `<html lang>`.
- Port `dict/en.ts` (~150 keys) as the source of `Dict`; port ru/kk from upstream (they exist).
- Wrap `<App/>` in `<I18nProvider>` in `main.tsx`.
- **Cyrillic note:** Archivo has no Cyrillic; the Inter Tight fallback + `months`/`monthsShort`
  arrays in the dicts are what make RU/KK render correctly. Keep them.

### ✅ Phase 3 — App shell + Register page (rewrite `src/App.tsx`, extract `src/components/`)
- Produce the upstream `App.tsx` logically first (so behavior/strings are 1:1), then **extract**
  per the §3.1 map into `src/components/*` and `src/pages/Register.tsx`. Do the extraction as a
  pure move — same class strings, same SVG paths, no behavior change.
- Header: wordmark + `REGISTER · ARCHIVE` tab nav (i18n), right meta column with
  `<LanguageSwitcher/>` + date + animated `role="status"` line (`meta-in`).
- Async register state: `useState<LoadState>` + `loadItems()`; render `RegisterSkeleton`
  (blank receipts/list lines) while loading, `RegisterError` (voided-slip) on failure with retry.
- Stat band: `soft-raised`; `pending` skeleton values until ready; `MoneyStat` breakdown
  popover (i18n strings); **remove `MonthlyRiskBand`**.
- Controls bar: filter segmented control (`sm:min-w-[104px] sm:w-auto`, string-length safe),
  List/Receipt toggle, `+ Register item` with `onPointerEnter/onFocus` → `prepareRegister()`
  (warms the OCR engine speculatively).
- Views: list rows + receipt grid, `print-in` on the newest filed record; `fresh` prop.
- `RiskFlag`: persistent dot + label, hover/focus-revealed recommendation (already in local
  code) but now i18n-keyed (`risk.{level}.label|rec`).
- Lazy-load the scanner: `const RegisterDialog = lazy(() => import('./scan/RegisterDialog'))`.
- `App.tsx` after extraction should be ~120–180 lines: state + `page` switch + `<Footer/>` +
  `<Suspense>`-wrapped dialog. Reuse `StatusDot` in `Archive.tsx` instead of its local copy.

### ✅ Phase 4 — Archive page
File: `src/pages/Archive.tsx` (default export `ArchivePage`; props `enriched`, `load`, `onRetry`).
- Header tabs already switch `page`; `ArchivePage` renders the ledger for **all** items.
- Port the **shelf/box metaphor** SVG components verbatim: `Compartment`, `BoxContents`,
  `ArchiveBox` (3 box variants), `ShelfBoard`, `ClosetArrow`; 4 years per "closet", arrows page
  through; container queries for box label sizing (`cqw`).
- Ledger: month groups via `groupByMonth`; rows (day, product, store·price, filed/missing tag);
  search (product/brand/store/serial/category, Ctrl/⌘-K focus), `ALL·FILED·MISSING` filter;
  keyboard row nav; empty state.
- Preview drawer: desktop sticky `md:w-72` aside, mobile bottom sheet + scrim; `Preview` meta block.
- `LedgerSkeleton` during load; `archive.notRead` error state with retry.

### ✅ Phase 5 — OCR scanner (optional track — see §6 for scope)
Files: `src/scan/{engine.ts,ocr.ts,ocr.worker.ts,parseReceipt.ts,dict.ts,RegisterDialog.tsx}`,
`src/scan/models/{ppocrv5-mobile-det.onnx,ppocrv5-mobile-rec-en.onnx}`; `vite.config.ts`;
`package.json`.
- Port the pipeline as-is first (parity), then consider §6 upgrades.
- `engine.ts`: pure PP-OCRv5 preprocessing (det LUT/BGR, DB post-process → min-area rect →
  unclip) and rec batching/CTC decode/line merge. No DOM/ORT imports (unit-testable).
- `ocr.worker.ts`: `onnxruntime-web` — try WEBGPU, fall back to WASM; model fetch with Cache
  Storage (`wk-ocr-v1`), same-origin `?url` first then HuggingFace mirror; kernel warmup.
- `ocr.ts`: main-thread client, `warmReader({speculative})`, `scanReceipt()` (transfers bitmap),
  `subscribeReader` status store.
- `RegisterDialog.tsx`: choose → camera (getUserMedia, torch, safe-area, `scan-sweep`) →
  scan (quad overlay) → review form with per-field confidence (`read`/`check`), drag/paste
  support, `print-in` save. Stored category values stay English; labels go through i18n.
- `vite.config.ts`: register the 4 Figma plugins; add `worker:{format:'es'}` and
  `optimizeDeps.exclude:['onnxruntime-web']`.
- Obtain the two models: `npm run fetch-models` (downloads from
  `PaddlePaddle/PP-OCRv5_mobile_det_onnx` and `PaddlePaddle/en_PP-OCRv5_mobile_rec_onnx`
  on HuggingFace and verifies size + sha256). ~4.8 MB + ~7.8 MB; the files are
  gitignored, so a fresh clone must run it before `npm run build`.

### ✅ Phase 6 — Dev tooling
- Add `src/dev/StateDemo.tsx`; wire the two `DEMO`-marked lines in `App.tsx`.
- Confirm `vite.config.ts` imports `.figma/make/site.json` and registers all plugins.

### ✅ Phase 7 — Verify & document
- `npm install` → `npx tsc --noEmit` → `npm run build` → `npm run dev`.
- Run the QA matrix in §8.
- **Update `CLAUDE.md`** to the new architecture (it currently documents the *old* repo: it says
  the Figma plugins are dead code, no i18n/pages/scan — all no longer true).
- Rebuild `dist/` if the repo is expected to ship the built output.

---

## 6. OCR deep-dive (performance / “experimental” track)

### 6.1 What upstream already does well
- **Fully on-device**, in a **module Web Worker**; main thread only sends an `ImageBitmap`.
- **WebGPU EP with automatic WASM fallback** (and a “GPU failed mid-run → switch to WASM for
  good” guard), sequential session creation (WebGPU rejects concurrent sessions).
- **Kernel pre-compile** at load (dummy 64×64 det + 48×160 rec) so the first scan is fast.
- **Smart sizing**: detector runs on a ~1.1 MP downscale; recognition crops read from the sharp
  ≤2400 px source; rec batches grouped by similar widths to limit padding.
- **Model caching** in Cache Storage (`wk-ocr-v1`) with a same-origin-first / HF-fallback fetch.
- **Speculative warm-up** on hover/focus, skipped when `navigator.connection.saveData`.
- **Pure-TS post-processing** (no OpenCV/wasm CV deps) — DB thresholding, monotone-chain hull,
  rotating-calipers min-area rect, unclip, CTC decode, baseline line merge, page-orientation
  disambiguation.
- WASM threads gated on `self.crossOriginIsolated`.

This is already a modern, high-performance design. Recommendation: **adopt it as the baseline.**

### 6.2 Option table for “latest / experimental” upgrades

| Option | Benefit | Cost / risk | Use when |
|---|---|---|---|
| **A. Multilingual rec model** (Cyrillic/latin PP-OCRv5 rec) routed by app language | OCR actually works for RU/KK users (current model is **English-only**) | +model size; dict + language routing; parser brand/category lists are EN-only | **Likely needed** — app ships RU/KK |
| B. **WebNN EP** (`webnn` provider) added to the WebGPU→WASM chain | Uses NPU on supported Chrome | Very limited availability; behind flag | Only as an opportunistic extra |
| C. **fp16 / int8 quantized** det+rec | Lower memory, faster on GPU | Accuracy loss; need conversion step | If latency/memory is a problem |
| D. **Service-worker precache** of models | Instant first scan after install | Adds SW lifecycle; Figma hosting constraints | If repeated cold loads hurt |
| E. **COOP/COEP headers** for WASM threads | Real multithreaded WASM speedup | Needs host header control; breaks some embeds | Only if Figma hosting allows |
| F. `transferControlToOffscreen` for capture/overlay | Less main-thread jank | More complex worker protocol | If profiling shows jank |
| G. `preload`/`prefetch` model URLs | Earlier download | Marginal vs. speculative warm | Cheap, low priority |

**Rejected alternatives (considered, not recommended):** `tesseract.js` (slower/less accurate),
`transformers.js` TrOCR (heavier, no layout detection), a Rust/WASM OCR (`ocrs`), or any
**server-side** OCR (this is a static, backend-less Figma Make).

### 6.3 Trigger rule
Start with the upstream pipeline (D3 recommended). Only pull in §6.2 options **when a concrete
need appears** — the strongest candidate being **A** (RU/KK receipts), because the i18n work
otherwise promises a language the OCR engine cannot read.

### 6.4 i18n ↔ OCR boundary (must-document)
Per the upstream plans, **not** translated: user/seed data, `parseReceipt.ts` brand/category
lists, and the OCR model (English-only). If we add option **A**, revisit `scan/dict.ts` and the
recognition charset, and consider language-aware `parseReceipt` dictionaries.

---

## 7. Figma MCP rules for agents (this migration)

1. **This file key is a Make file** (`csyBeQ21GnrycKRpxlwV47`). Use `get_design_context` with a
   node id (`0:1`) to get the **source manifest**, then read each file as an MCP resource.
   `get_metadata` is not supported for Make files.
2. **Never** paste Figma design code as-is from a generic design node — for Make files the
   *source files are the design*. Port them.
3. For any **raster/SVG** used by the design, use `download_assets` (design nodes) or the
   `file://figma/make/image/...` resources (Make images); **no temporary Figma URLs in code**.
4. Keep the codebase conventions from `CLAUDE.md`: Tailwind v4 CSS-first tokens (no
   `tailwind.config.js`), square corners, semantic color tokens, no new UI deps, pure
   domain/stats layers, `oxfmt` formatting.
5. Prefer **`git`-tracked, reviewable commits per phase** (do `git init` first).
6. Update `CLAUDE.md` in the same PR as the port.

---

## 8. Verification & QA matrix

**Verification performed (port completion):**

- ✅ `npx tsc --noEmit` — clean (exit 0).
- ✅ `npm run build` — succeeds; `dist/` contains `ocr.worker-*.js`, `ort.wasm.bundle.min-*.js`,
  `ort.webgpu.bundle.min-*.js`, `ppocrv5-mobile-det-*.onnx` (4,826.51 kB) and
  `ppocrv5-mobile-rec-en-*.onnx` (7,848.42 kB), plus the wasm assets and `robots.txt`.
- ✅ `npm run dev` smoke test — `/` serves `index.html` with `site.json` metadata injected
  (description, `robots noindex,nofollow`, `og:*`), `/robots.txt` served by the plugin
  middleware, and `/src/main.tsx` transforms (200).
- ✅ Byte-for-byte comparison of ported files against the upstream source URIs (UTF-8 length
  match, e.g. `src/index.css` 7216, `src/lib/format.ts` 1861, `src/domain/repo.ts` 2188,
  `src/domain/warranty.ts` 2939, `src/pages/Archive.tsx` 27831, `src/scan/RegisterDialog.tsx`
  28084). `src/stats/{priceStats,riskStats,types}.ts` match upstream exactly (1840 / 2574 / 846)
  after repairing a pre-existing bulk semicolon-strip that had corrupted them.
- ⚠️ **Not performed:** the interactive manual matrix below (no browser/display in the agent
  environment) — run it before shipping.

**Static:** `npx tsc --noEmit` clean; `npm run build` succeeds; no stray Figma URLs; rgrep for
leftover English literals in touched TSX.

**Manual (dev server, `PORT`/`8443`):**
- **Register:** loading skeleton → ready; load-error → retry; list + receipt views; all four
  filters; Value-covered popover; risk flag hover/focus reveal; `print-in` on new item; empty state.
- **Archive:** tabs; shelf/box rendering + paging arrows; search (incl. no-result + clear);
  `ALL/FILED/MISSING` counts (missing count uses `text-signal`); ledger rows; keyboard nav;
  preview drawer (desktop sticky + mobile sheet + scrim); skeleton + not-read states.
- **Scan (if in scope):** reader preparing % → ready (backend label); take photo (camera
  blocked/unavailable fallbacks); upload; drag & drop; paste; quad overlay + `scan-sweep`;
  review field confidence `read`/`check`; retake; save `printing…`; error notices.
- **i18n:** EN / RU / KZ across all of the above; verify **no tofu** — Cyrillic headings render
  in Inter Tight; dates/number grouping/plurals correct per locale; `<html lang>` updates;
  choice persists across reload; ru-locale browser detects on first load.
- **Responsive:** 320 / 375 / 768 / desktop — no overflow in header, filter bar, stat band,
  receipt cards, archive shelves; `env(safe-area-inset-*)` respected on camera view.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| No VCS → destructive port | `git init` + baseline commit before any change (D7) |
| i18n volume (~150 keys × 3) | Port upstream ru/kk verbatim; `satisfies Dict` catches gaps at compile time |
| Model size (~12.7 MB) in repo | **Resolved:** models are gitignored and restored with `npm run fetch-models` (verifies size + sha256); worker keeps the HF mirror as fallback |
| WebGPU/crossOriginIsolated unavailable in Figma hosting | Already handled: WASM fallback, `numThreads=1` when not isolated |
| OCR can’t read RU/KK text | §6.2 option **A**, gated on “if needed” |
| `vite.config.ts` plugin registration changes dev behavior | Port exactly; verify dev overlay/HMR + `/.figma/make/kit.html` route |
| `dist/` drift | Rebuild at end (Phase 7) |

---

## 10. Out of scope
- Redesigning anything beyond upstream parity.
- New backend/server-side OCR or persistence (app is static + localStorage).
- Translating user/seed data, OCR brand/category dictionaries, or the OCR model itself
  (unless option A is chosen).
- Touching `ipynb/` (unrelated coursework).

---

## 11. File-by-file port checklist

Source URIs are `file://figma/make/source/csyBeQ21GnrycKRpxlwV47/<path>`.

- [x] `package.json` — add `onnxruntime-web ^1.30.0`
- [x] `scripts/fetch-models.mjs` — download + verify the gitignored OCR models
- [x] `vite.config.ts` — register plugins; worker/optimizeDeps; import site.json
- [x] `.figma/make/site.json` — add
- [x] `src/index.css` — replace (tokens + classes + animations + Inter Tight)
- [x] `src/main.tsx` — wrap `I18nProvider`
- [x] `src/App.tsx` — rewrite slim shell (page switch, state, footer, lazy dialog)
- [x] `src/components/Header.tsx` — extract *(refactor)*
- [x] `src/components/Footer.tsx` — extract *(refactor)*
- [x] `src/components/Stat.tsx` — extract *(refactor)*
- [x] `src/components/MoneyStat.tsx` — extract *(refactor)*
- [x] `src/components/StatusDot.tsx` — extract *(refactor, reused by Archive)*
- [x] `src/components/ProgressLeft.tsx` — extract *(refactor)*
- [x] `src/components/ReceiptCard.tsx` — extract *(refactor)*
- [x] `src/components/RiskFlag.tsx` — extract *(refactor)*
- [x] `src/components/RegisterSkeleton.tsx` — extract *(refactor)*
- [x] `src/components/RegisterError.tsx` — extract *(refactor)*
- [x] `src/pages/Register.tsx` — extract `RegisterPage` *(refactor)*
- [x] `src/lib/barcode.ts` — extract `barcodesFrom` *(refactor)*
- [x] `src/domain/warranty.ts` — add `groupByMonth`
- [x] `src/domain/repo.ts` — add
- [x] `src/lib/format.ts` — rewrite (locale-aware)
- [x] `src/stats/monthlyRiskStats.ts` — delete; `src/stats/index.ts` — update
- [x] `src/i18n/index.tsx` — add
- [x] `src/i18n/LanguageSwitcher.tsx` — add
- [x] `src/i18n/dict/{en,ru,kk}.ts` — add
- [x] `src/pages/Archive.tsx` — add
- [x] `src/dev/StateDemo.tsx` — add
- [x] `src/scan/engine.ts` — add *(optional)*
- [x] `src/scan/ocr.ts` — add *(optional)*
- [x] `src/scan/ocr.worker.ts` — add *(optional)*
- [x] `src/scan/parseReceipt.ts` — add *(optional)*
- [x] `src/scan/dict.ts` — add *(optional)*
- [x] `src/scan/RegisterDialog.tsx` — add *(optional)*
- [x] `src/scan/models/*.onnx` — gitignored; restored via `npm run fetch-models` *(optional)*
- [x] `CLAUDE.md` — update to new architecture
- [x] `dist/` — rebuild
