# CLAUDE.md — Warranty Keeper (Figma Make App)

Rules and conventions for AI agents working in this repo, with emphasis on
**integrating Figma designs via the Figma MCP server**.

> This project is a **Figma Make export** (`package.json` name: `figma-make-app`).
> It is a single-page Preact 11 compat + Vite + Tailwind v4 app called **Warranty Keeper**.
> Keep it looking like it was produced by Figma Make: minimal dependencies,
> no build config sprawl, Tailwind utilities for layout, and a small set of
> hand-rolled component classes in `src/index.css`.
>
> **This repo mirrors the current Figma Make upstream** (`Warranty-tracker-app`,
> file key `csyBeQ21GnrycKRpxlwV47`). The port plan lives in
> [`agents-figma.md`](agents-figma.md); its phases are complete and the §8 QA matrix
> passes (30/30 checks via `qa/playwright-qa.mjs`). Upstream is the source of truth —
> prefer upstream file contents verbatim over local rewrites. Upstream's own design
> documents are mirrored in [`plans/`](plans).

---

## 0. Quick reference

| Concern | Answer |
|---|---|
| Language | TypeScript (strict), `.tsx` / `.ts` |
| UI framework | Preact 11 via `preact/compat` — **no** router, **no** state lib |
| Styling | Tailwind CSS **v4** via `@tailwindcss/vite` (CSS-first config, **no `tailwind.config.js`**) |
| Build | Vite 8 + `@vitejs/plugin-react`, Rolldown-based |
| Package manager | npm (`package-lock.json`) |
| Formatter | `oxfmt` (`npm run format`) — semicolon-free style; **no ESLint / Prettier / tests** |
| Entry | `index.html` → `src/main.tsx` → `src/App.tsx` (wrapped in `I18nProvider`) |
| Tokens | `@theme` block in `src/index.css` |
| Components | `src/components/*` (primitives) + `src/pages/*` (Register, Archive) |
| State | `useState`/`useMemo` in `src/App.tsx`; persistence via `src/domain/repo.ts` |
| i18n | EN / RU / KK via `src/i18n` (`useI18n()`, dictionaries in `src/i18n/dict`) |
| OCR | On-device PaddleOCR PP-OCRv6 tiny via `onnxruntime-web` in a Web Worker (`src/scan`) |
| Icons | None — inline SVG + Unicode glyphs only |
| Assets | Google Fonts CDN; two `.onnx` models in `src/scan/models/` (gitignored — run `npm run fetch-models`) |
| Alias | `@/*` → `./src/*` (configured in `tsconfig.json` + `vite.config.ts`; source uses relative imports) |
| QA | `node qa/playwright-qa.mjs` — headless-Chromium pass over the §8 matrix (Playwright is **not** a project dep) |

**Golden rules for agents**

1. Do **not** add `tailwind.config.js`, PostCSS config, or CSS modules. Tailwind v4 is configured *in CSS*.
2. Do **not** add dependencies (icon packs, component libraries, styling libs) unless explicitly asked. Match the existing hand-rolled aesthetic.
3. Put new shared UI primitives in `src/components/` and full pages in `src/pages/`, matching the existing file-per-component layout (`export default function Foo`, props as an inline object type).
4. New design tokens go in the `@theme` block in `src/index.css`; reference them via Tailwind utility names (`bg-signal`, `text-muted`, …).
5. **Do not** re-implement the Figma layer differently per-screen — extend the existing token + utility vocabulary.
6. **Do not** rename, reorder, or re-word upstream markup: the port is high-fidelity to the Figma Make source.

---

## 1. Design System Structure

### 1.1 Token definitions

All design tokens live in one place: the `@theme` block at the top of
[`src/index.css`](src/index.css). This is Tailwind v4's CSS-first config; there is
**no** JS/JSON token file and **no** `tailwind.config.*`.

```css
/* src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
@import 'tailwindcss';

@theme {
  --font-display: 'Archivo', sans-serif;   /* -> font-display */
  --font-body:    'Inter', sans-serif;      /* -> font-body    */
  --font-mono:    'JetBrains Mono', monospace; /* -> font-mono */

  --color-paper:   #fbfaf7; /* page background, near-white warm paper */
  --color-ink:     #25262a; /* primary text / dark UI, softer than black */
  --color-line:    #e9e5dc; /* hairline borders & separators */
  --color-muted:   #73757c; /* secondary text / micro-labels */
  --color-signal:  #db4433; /* accent: rust red (expired, destructive, CTA) */
  --color-warn:    #d97706; /* accent: amber (expiring soon) */
  --color-ok:      #2f9464; /* accent: green (active / OK) */
  --color-receipt: #fffefa; /* card surface (slightly brighter than paper) */

  --grid-line: rgba(125, 101, 53, 0.028); /* non-namespaced CSS var */
  --grid-size: 26px;                       /* non-namespaced CSS var */
}
```

**Token → utility mapping (Tailwind v4 auto-generates these):**

| Token | Generated utilities |
|---|---|
| `--color-paper` | `bg-paper`, `text-paper`, `border-paper` |
| `--color-ink` | `bg-ink`, `text-ink`, `border-ink`, `bg-ink/40` (opacity modifier works) |
| `--color-line` | `bg-line`, `border-line`, `border-line/80` |
| `--color-muted` | `text-muted` |
| `--color-signal` | `bg-signal`, `text-signal` |
| `--color-warn` | `bg-warn`, `text-warn` |
| `--color-ok` | `bg-ok`, `text-ok` |
| `--color-receipt` | `bg-receipt` |
| `--font-display` | `font-display` |
| `--font-body` | `font-body` |
| `--font-mono` | `font-mono` |
| `--grid-line` / `--grid-size` | raw `var(--grid-line)` / `var(--grid-size)` only |

**Format / structure rules**

- Use **hex** colors for solid tokens; `rgba()` is used only for translucent
  shadows and grid lines.
- Token names are semantic (`signal`, `warn`, `ok`, `paper`, `ink`), not
  literal (`red500`). Add new semantic names, never raw color names.
- Non-namespaced vars (e.g. `--grid-line`) are still valid theme vars and can be
  consumed with `var(...)` in custom classes or inline `style`.
- Opacity modifiers (`text-muted/50`, `bg-ink/40`) are used throughout — prefer
  them over hardcoding alpha colors.

### 1.2 Token transformation systems

**None.** Runtime theming is handled by `src/lib/theme.ts` and `ThemeSwitcher`;
tokens are compile-time CSS variables emitted by Tailwind v4.
If Figma variables/tokens need to be synced, translate them **by hand** into the
`@theme` block (and note any new token in this file).

### 1.3 Spacing / typography scale

- **Spacing**: Tailwind's default numeric scale (`gap-3`, `py-3.5`, `px-[9px]`).
  Arbitrary values are used freely for pixel-perfect Figma matching
  (`tracking-[0.22em]`, `text-[9px]`, `shadow-[...]`). This is expected and on-brand.
- **Typography**: three families (`font-display`, `font-body`, `font-mono`).
  Micro-labels are a strong pattern:
  `font-mono text-[9px|10px] uppercase tracking-[0.2em] text-muted`.
- **Radii**: **square corners by design.** The aesthetic is a printed receipt /
  ledger; `rounded-*` is essentially unused except the tiny popover caret
  (`rotate-45`). Do not round cards or buttons.
- **Shadows**: defined as arbitrary utilities, not tokens, and repeated inline
  (e.g. the receipt lift). If you add a new one, copy the existing string.

---

## 2. Component Library

### 2.1 Where components live

Components are **one React component per file**, with no Storybook and no barrel
files. Primitives and layout chrome live in [`src/components/`](src/components);
full views live in [`src/pages/`](src/pages); the app shell is
[`src/App.tsx`](src/App.tsx), which owns state and composition.

Component inventory:

| Component | File | Role |
|---|---|---|
| `App` (default export) | `src/App.tsx` | State owner + composition: header, footer, register/archive switch, lazy scanner dialog. Exports `type LoadState` |
| `Header` | `src/components/Header.tsx` | Masthead: wordmark, page nav, `LanguageSwitcher`, date, file-status line. Exports `type Page`, `type Meta` |
| `Footer` | `src/components/Footer.tsx` | Colophon rule with record count |
| `RegisterPage` | `src/pages/Register.tsx` | Stat band, filter/view controls, list + receipt grid. Exports `type Filter`, `type ViewMode` |
| `ArchivePage` | `src/pages/Archive.tsx` | Receipt archive grouped by purchase month, with filed/missing filter |
| `Stat` | `src/components/Stat.tsx` | Stat-band cell with an optional `accent` of `ok`, `warn`, or `signal` |
| `MoneyStat` | `src/components/MoneyStat.tsx` | Clickable "Value covered" cell + breakdown popover |
| `StatusDot` | `src/components/StatusDot.tsx` | 2x2 status square (signal/warn/ok) — reused in Register list and Archive |
| `ProgressLeft` | `src/components/ProgressLeft.tsx` | Draining progress bar + time-left label (list view) |
| `ReceiptCard` | `src/components/ReceiptCard.tsx` | The hero receipt card with perf strips, barcode, risk flag |
| `RiskFlag` | `src/components/RiskFlag.tsx` | Status band + hover-revealed recommendation |
| `RegisterSkeleton` / `RegisterError` | `src/components/RegisterSkeleton.tsx`, `RegisterError.tsx` | Async load placeholders for the register |
| `RegisterDialog` | `src/scan/RegisterDialog.tsx` | Modal form + on-device OCR receipt scanner (lazy-loaded) |
| `LanguageSwitcher` | `src/i18n/LanguageSwitcher.tsx` | EN/RU/KK switcher |
| `StateDemo` | `src/dev/StateDemo.tsx` | DEMO-only load-state cycle trigger (remove with `src/dev`) |

Helpers: `barcodesFrom(serial)` in [`src/lib/barcode.ts`](src/lib/barcode.ts) generates barcode bar widths.

### 2.2 Component architecture

- **Plain function components** with inline `type` props — no `React.FC`, no
  PropTypes, no forwardRef, no context except React's own `useState/useMemo`.
- Props are declared as an inline object type on the parameter:
  ```tsx
  export default function Stat({
    label,
    value,
    accent,
  }: {
    label: string
    value: string
    accent?: "ok" | "warn" | "signal"
  }) { /* ... */ }
  ```
- **Class composition** is done with template literals and ternaries keyed on
  status/variant — there is no `clsx`/`cva`/`twMerge`:
  ```tsx
  const barColor =
    status === "expired" ? "bg-signal" : status === "soon" ? "bg-warn" : "bg-ok"
  ```
- **Derived state** lives in `useMemo` inside `App` and is passed down as props
  (`enriched`, `counts`, `covered`, `priceStats`, `risks`, `riskByItemId`,
  `visible`). Child components are otherwise stateless — they don't fetch or
  mutate the register.
- **All copy comes from the i18n dictionary**, never hardcoded: components call
  `const { t, fmt } = useI18n()` and render `t("key")` / `fmt.money(...)`.
  Formatting lives in [`src/lib/format.ts`](src/lib/format.ts) and is exposed
  through `fmt`, not called directly.
- **Repeated shadow strings** are inlined verbatim on surfaces (stat band, list
  panel, receipt). They are *not* extracted to a token/class (the receipt card
  shadow *is* in `.receipt-card`). Preserve exact strings when copying.

### 2.3 Documentation / Storybook

- No Storybook, no MDX, no doc comments beyond concise `//` header comments.
- `vite.config.ts` registers four Figma Make plugins: `figmaSiteConfiguration`
  (applies `.figma/make/site.json` to the HTML shell + serves `robots.txt`),
  `figmaErrorOverlayReplay`, and
  `figmaMakeKitPlugin` (dev-only route `/.figma/make/kit.html` exposing
  `window.__FIGMA__.stories` from `/src/**/*.stories.{ts,tsx,js,jsx}` — there are
  currently zero story files, so it simply renders an empty registry).
  These are upstream files; treat them as part of the port and don't strip them.

---

## 3. Frameworks & Libraries

### 3.1 UI framework

Preact 11 through `preact/compat` with the automatic JSX runtime (`"jsx": "react-jsx"`
in `tsconfig.json`). No routing, no data-fetching, no form library, no UI kit. The
runtime dependencies are Preact and the on-device OCR runtime:

```jsonc
// package.json
"dependencies": {
  "onnxruntime-web": "^1.30.0",
  "preact": "^11.0.2"
}
```

### 3.2 Styling library

Tailwind CSS v4 through the official Vite plugin. **CSS-first** — the config is
the `@theme` block, not a JS file.

```ts
// vite.config.ts
plugins: [react(), tailwindcss()],
resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
```

Tailwind utilities are used for ~everything; a handful of bespoke component
classes are authored with `@layer`/plain CSS in `src/index.css` (see §6).

### 3.3 Build system & bundler

- **Vite 8** (Rolldown-based), `@vitejs/plugin-react`.
- `npm run dev` → dev server on `0.0.0.0:8443` (overridable via `PORT` /
  `FIGMA_DEV_SERVER_HOST`); `strictPort: true`.
- `npm run build` → `dist/`; `npm run preview`.
- `base` is derived from `FIGMA_PUBLIC_URL` (Figma hosting) and falls back to `/`.
- `mode === "development"` emits inline sourcemaps and disables minify (used by
  Figma Make cached-preview builds).
- Dev server ignores `**/.figma/**` in the watcher.
- `worker: { format: "es" }` — the receipt-reader worker code-splits
  `onnxruntime-web` per backend; `optimizeDeps.exclude: ["onnxruntime-web"]` keeps
  its `.wasm` files resolving next to its own module.
- No path aliases are actually used in source yet (`@/…` is unused; imports are
  relative like `./domain/warranty`). You may use `@/…` if you prefer.

### 3.4 Localization (i18n)

- [`src/i18n/index.tsx`](src/i18n/index.tsx) holds a hand-rolled provider: a
  `I18nProvider` (mounted in `src/main.tsx`) plus a `useI18n()` hook exposing
  `{ lang, setLang, t, fmt }`.
- Dictionaries are plain typed objects in [`src/i18n/dict/`](src/i18n/dict):
  `en.ts`, `ru.ts`, `kk.ts`, each `satisfies Dict`. Keys are dotted namespaces
  (`stats.total`, `list.expires`, `controls.register`, …).
- `t(key, vars?)` interpolates `{var}` tokens; `fmt` wraps
  [`src/lib/format.ts`](src/lib/format.ts) with the active locale
  (`fmt.money`, `fmt.date`, `fmt.left`, `fmt.category`, `fmt.warranty`, `fmt.error`).
- Add a string → add it to **all three** dictionaries (the `Dict` type will fail
  the build if one is missing).
- `LanguageSwitcher` is rendered from `Header`.

### 3.5 On-device OCR (receipt scanner)

- [`src/scan/`](src/scan) is the full PaddleOCR PP-OCRv6 tiny pipeline, run in a Web
  Worker: `ocr.worker.ts` (worker entry), `engine.ts` (det/rec + CTC decode),
  `parseReceipt.ts` (text → receipt fields), `dict.ts` (charset),
  `RegisterDialog.tsx` (camera/upload UI), `ocr.ts` (main-thread client +
  `warmReader()` warm-up).
- The tiny tier keeps the reader ~6.2 MB and several times faster than PP-OCRv5
  mobile while matching it on clean receipt lines. `dict.ts` is the model's
  ASCII/Latin/symbol prefix (616 of 6 905 classes); the CTC decoder skips the
  CJK/fullwidth tail because this reader only targets Latin-script receipts.
- Runtime is `onnxruntime-web` with **WebGPU first, WASM fallback**; the two
  models are imported from [`src/scan/models/`](src/scan/models) with `?url` (bundled,
  not fetched from a CDN at build time). That directory is **gitignored** — run
  `npm run fetch-models` after cloning (see §4). The worker keeps a runtime
  HuggingFace mirror as a second URL in case the bundled asset can't be read.
- **Setup:** `npm install` → `npm run fetch-models` → `npm run dev` / `npm run build`.
- The scanner is lazy-loaded: `App.tsx` imports `./scan/RegisterDialog` on first
  intent (hover/focus of Register) or on open, and pre-warms the reader.
- Keep the pipeline client-side; do not move inference to a server.

### 3.6 QA harness (headless Chromium)

- [`qa/playwright-qa.mjs`](qa/playwright-qa.mjs) is a **standalone script** (no project
  dependency) that drives the whole app in a headless Chromium and asserts the QA
  matrix in [`agents-figma.md`](agents-figma.md) §8: register states/filters/views,
  archive ledger/drawer/closet paging, EN/RU/KZ switching and persistence, responsive
  overflow, the DEMO fault injector, and the real on-device OCR flow (upload → review →
  save, clipboard paste, camera with a fake device, retake, save failure).
- It renders its own synthetic receipt with the browser, so there are no binary
  fixtures; screenshots land in `qa/shots/` (gitignored).
- Run it with the dev server up:
  ```bash
  npm run dev                       # terminal 1
  npx playwright install chromium   # once
  node qa/playwright-qa.mjs         # terminal 2 → 30 checks
  ```
- Playwright is **not** in `package.json` on purpose — it resolves a global install at
  runtime. Do not add it as a dependency; do not commit `qa/shots/`.

---

## 4. Asset Management

- **Fonts** are loaded from the **Google Fonts CDN** via `@import` at the top of
  `src/index.css` (Archivo, Inter, JetBrains Mono).
- **The only binary assets** are the two OCR models used by the scanner
  (`ppocrv6-tiny-det.onnx` ~1.8 MB, `ppocrv6-tiny-rec.onnx` ~4.5 MB).
  They live in `src/scan/models/`, are **gitignored**, and are imported with `?url`
  from `ocr.worker.ts` (emitted to `dist/assets/`). Run **`npm run fetch-models`**
  after cloning — it downloads them from the PaddlePaddle HuggingFace repos and
  verifies size + sha256 (`-- --check` verifies without downloading). There is
  still no `public/`, `src/assets`, or committed image/video/font.
- **Graphics** are generated in code, not imported:
  - the receipt torn edge is an inline `<svg>` path (`src/components/MoneyStat.tsx`),
  - the barcode is a row of styled `<div>` bars (`src/components/ReceiptCard.tsx`,
    widths from `src/lib/barcode.ts`),
  - the paper grid / perforation strips are CSS gradients (`src/index.css`).
- **Optimization / CDN config**: none beyond Google Fonts + the `FIGMA_PUBLIC_URL`
  base path. Vite's default asset hashing applies to the built bundle only.
- If a Figma design introduces raster assets, add them under `public/` or
  `src/assets/` and note the new convention here; prefer SVG-in-JSX for icons and
  simple art to match the existing approach.

---

## 5. Icon System

- **There is no icon library and no icon directory.** Do not add `lucide`,
  `heroicons`, etc.
- Icons are **inline SVG** (rare — one instance, the torn-edge `path`) or
  **Unicode/glyph characters** rendered in the mono font:
  - `✓` "RECEIPT ON FILE" and `✗` "NO RECEIPT" (`src/components/ReceiptCard.tsx`),
    `>` chevron in the `MoneyStat` popover, `+` on the Register button
    (`src/pages/Register.tsx`), `✕` close (`src/scan/RegisterDialog.tsx`).
  - Status is conveyed by filled squares (`StatusDot`, `RiskFlag`) rather than icons.
- **Convention**: prefer geometric primitives (dots, bars, squares) and text
  glyphs over pictographic icons. All decorative marks get `aria-hidden`.
- When Figma supplies real icons, inline them as JSX `<svg>` with
  `currentColor`/CSS var fills (as done with `fill="var(--color-paper)"`), so they
  inherit the token palette.

---

## 6. Styling Approach

### 6.1 Methodology

- **Primarily Tailwind utility classes** directly in `className`.
- **Secondary**: a small set of semantic component classes in
  [`src/index.css`](src/index.css): `.receipt-card` (+ `.is-blank`), `.receipt-product`,
  `.receipt-perf-top`, `.receipt-perf-bottom`, `.receipt-dash`, `.archive-slip`,
  `.soft-raised` / `.soft-key` / `.soft-pressed`, `.skeleton-pulse` / `.skeleton-bar`,
  `.print-in`, `.meta-in`, and the scanner classes `.scan-sweep`, `.quad-in`,
  `.shutter-flash` — plus the `moneyPop`, `skeletonPulse`, `printIn`, `metaIn`,
  `scanSweep`, `quadIn`, `shutterFlash` keyframes (all disabled under
  `prefers-reduced-motion`).
- **Tertiary**: inline `style` for runtime-dynamic values only
  (`width: ${pct}%`, barcode bar `width`/`height`, `background: var(--color-receipt)`).
- No CSS Modules, no styled-components, no emotion, no `@apply`-heavy usage.

### 6.2 Global styles

`src/index.css` sets globals on `html, body, #root` (full height), `body`
(font family, ink color, paper background with a fixed ochre grid overlay),
`::selection`, and thin/invisible scrollbars. Import order matters: Google Fonts
→ `@import 'tailwindcss'` → `@theme` → global rules → component classes.

### 6.3 Responsive design

Mobile-first Tailwind breakpoints (`sm: md: lg: xl:`) with **desktop density
shrunk down** rather than a separate mobile layout:

- Receipt grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
  (`src/pages/Register.tsx`).
- Stat band: `grid-cols-2 lg:grid-cols-4` (`src/pages/Register.tsx`).
- List rows switch from stacked to `md:grid-cols-[1fr_auto_auto_auto]`
  (`src/pages/Register.tsx`).
- Compact-label swaps via `hidden sm:inline` / `sm:hidden` (`src/pages/Register.tsx`,
  `src/components/Header.tsx`).
- Typography scales with pairs like `text-[9px] sm:text-[10px]` and
  `tracking-[0.14em] sm:tracking-[0.18em]`.

Follow this stacking pattern; do not introduce container queries or CSS `@media`
blocks unless unavoidable.

---

## 7. Project Structure

```
Math/                         # repo root (git repo)
├── index.html                # Vite shell; contains Figma slot comments
├── package.json              # "figma-make-app", scripts: dev/build/preview/format
├── tsconfig.json             # strict TS, jsx: react-jsx, @/* alias
├── vite.config.ts            # Vite config + the four Figma Make plugins
├── .vscode/mcp.json          # Figma MCP server registration (HTTP)
├── .figma/make/site.json     # site metadata applied to the HTML shell
├── agents-figma.md           # port plan + phase log against the Figma Make upstream
├── plans/                    # upstream Figma Make design docs (ported verbatim)
├── qa/
│   └── playwright-qa.mjs     # automated §8 QA matrix (headless Chromium; not a dep)
├── dist/                     # build output (generated; do not hand-edit)
├── ipynb/                    # unrelated Kazakh statistics coursework (ignore)
└── src/
    ├── main.tsx              # React root; I18nProvider + ./index.css
    ├── App.tsx               # shell: state, composition, lazy scanner dialog (exports LoadState)
    ├── index.css             # tokens (@theme), globals, component classes
    ├── vite-env.d.ts         # /// <reference types="vite/client" />
    ├── components/           # one component per file (layout chrome + primitives)
    │   ├── Header.tsx        # masthead, nav (exports Page, Meta)
    │   ├── Footer.tsx        # colophon rule
    │   ├── Stat.tsx / MoneyStat.tsx
    │   ├── StatusDot.tsx / ProgressLeft.tsx / RiskFlag.tsx
    │   ├── ReceiptCard.tsx   # hero receipt card
    │   └── RegisterSkeleton.tsx / RegisterError.tsx
    ├── pages/
    │   ├── Register.tsx      # stat band + controls + list/receipt views (exports Filter, ViewMode)
    │   └── Archive.tsx       # receipt archive grouped by purchase month
    ├── i18n/
    │   ├── index.tsx         # I18nProvider + useI18n() ({ lang, setLang, t, fmt })
    │   ├── LanguageSwitcher.tsx
    │   └── dict/             # en.ts, ru.ts, kk.ts (each `satisfies Dict`)
    ├── scan/                 # on-device OCR receipt reader (Web Worker)
    │   ├── RegisterDialog.tsx
    │   ├── ocr.ts / ocr.worker.ts / engine.ts / parseReceipt.ts / dict.ts
    │   └── models/           # vendored PP-OCRv6 tiny .onnx models (det + rec)
    ├── dev/
    │   └── StateDemo.tsx     # DEMO-only load-state trigger (remove with src/dev)
    ├── domain/               # pure domain model (no React)
    │   ├── warranty.ts       # WarrantyItem, EnrichedItem, enrich/count/covered/groupByMonth
    │   ├── repo.ts           # ItemDraft, loadItems(), saveItem() (async, error codes)
    │   └── seed.ts           # SEED: WarrantyItem[] demo data
    ├── lib/
    │   ├── format.ts         # money/date/left/category/warranty/error formatters
    │   └── barcode.ts        # barcodesFrom(serial)
    └── stats/                # pure statistics modules (no React)
        ├── index.ts          # public barrel for the stats layer
        ├── types.ts          # StatContext, StatModule<T>
        ├── context.ts        # buildStatContext()
        ├── priceStats.ts     # priceCoverStat / computePriceStats / quantile
        └── riskStats.ts      # warrantyRiskStat / computeWarrantyRisk
```

### 7.1 Architectural patterns to follow

- **Layered, React-free core.** `domain/`, `stats/`, and `lib/` are pure
  TypeScript; React lives only in `App.tsx`, `components/`, `pages/`, `scan/`, and
  `i18n/`. `lib/format.ts` explicitly holds "no domain logic".
- **Repository seam for persistence.** `domain/repo.ts` exposes `loadItems()` and
  `saveItem(draft)`, both async and coded with `RepoError` codes
  (`LOAD_FAILED` / `SAVE_FAILED`) that `fmt.error` renders. `App` is the only
  caller; it tracks a `LoadState` (`loading | error | ready`) and a
  `useCallback` fetch that guards against stale writes.
- **`StatModule<T>` seam.** Each statistic exports a self-contained module
  `{ id, label, compute(ctx) }`, registered in `stats/index.ts`. Adding a
  statistic is a one-file change plus a barrel export:
  ```ts
  // src/stats/types.ts
  export type StatModule<T> = {
    id: string
    label: string
    compute: (ctx: StatContext) => T
  }
  ```
- **Single enrichment source of truth.** `enrichItems()` produces `EnrichedItem {
  it, days, status, expiry }`; all stats consume `StatContext` (`all`, `covered`)
  built once per register change. `groupByMonth()` (in `domain/warranty.ts`) feeds
  the Archive page.
- **Deterministic rendering.** `TODAY` is a fixed date in `domain/warranty.ts` so
  the UI renders identically every run. Don't replace it with `new Date()`.
- **Upstream fidelity.** File contents mirror the Figma Make source
  (`csyBeQ21GnrycKRpxlwV47`) — adapt only what the port plan requires (import
  paths, file splits, `?url` model imports). Don't "improve" markup or copy.
- `ipynb/` is **unrelated** Python/Kazakh statistics coursework. Never modify or
  reference it when working on the web app.

---

## 8. Figma MCP integration rules

### 8.1 MCP registration

The Figma MCP server is registered in [`.vscode/mcp.json`](.vscode/mcp.json):

```json
{
  "servers": {
    "com.figma.mcp/mcp": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "gallery": "https://api.mcp.github.com",
      "version": "1.0.3"
    }
  },
  "inputs": []
}
```

### 8.2 Design → code (implementing a Figma design)

1. **Load the `figma-design-to-code` skill first** (mandatory before
   `get_design_context`) and extract `fileKey`/`nodeId` from the Figma URL.
2. Treat Figma output as a **reference**, then adapt it into this codebase's
   vocabulary:
   - map Figma colors to the nearest `@theme` token (`signal`/`warn`/`ok`/…);
     add a new semantic token only if no match exists,
   - map fonts to `font-display` / `font-body` / `font-mono`,
   - keep corners square and match the receipt/ledger aesthetic,
   - reuse `Stat`, `ReceiptCard`, `StatusDot`, etc. instead of new one-offs,
     and place new shared primitives in `src/components/` (pages in `src/pages/`).
3. Avoid introducing libraries to match a design; reimplement with Tailwind
   utilities + inline SVG.
4. Add new copy to all three `src/i18n/dict/*` files (never hardcode strings),
   then verify responsive behavior with the pattern in §6.3.

### 8.3 Code → design (pushing UI into Figma)

- `search_design_system` / `get_libraries` first; reuse existing components and
  tokens before creating anything new.
- For a full page, pair `generate_figma_design` (pixel capture) with `use_figma`
  (rebuild from design-system primitives), then remove the capture reference.
- Mirror the token names in §1.1 into the Figma library so the two stay aligned.

### 8.4 Figma Make hosting hooks

- `vite.config.ts` registers the Preact preset plus the Figma Make plugins in
  `plugins`: `preact()`, `tailwindcss()`,
  `figmaSiteConfiguration(siteConfiguration)` (applies `.figma/make/site.json` to
  the HTML shell and serves `/robots.txt`), `figmaErrorOverlayReplay()`,
  `figmaMakeKitPlugin({ storiesGlob: "/src/**/*.stories.{ts,tsx,js,jsx}" })`
  (dev-only `/.figma/make/kit.html` route).
- `.figma/make/site.json` drives the `<title>`, description, `robots` meta and
  `robots.txt`. It currently has no `title`, so the shell keeps `index.html`'s
  default "Figma Make App" — that matches upstream.
- `index.html` contains Figma slot comments (`<!-- figma:lang -->`,
  `<!-- figma:title -->`, `<!-- figma:head-start -->`, `<!-- figma:body-start -->`,
  …). Preserve these markers when editing the shell — the site plugin
  substitutes them.
- `base` honors `FIGMA_PUBLIC_URL`; dev/preview port honors `PORT` and
  `FIGMA_DEV_SERVER_HOST`.

---

## 9. Gotchas checklist

- ❌ **Running `npm run format` (oxfmt) over the whole tree.** On 2026‑09‑29 a bulk
  formatting pass rewrote every file *including* `node_modules/**/*.d.ts` and stripped the
  `;` separators inside inline type literals (`{ price: number status: string item: T }`),
  which breaks `tsc` with `TS1005`. `node_modules` was reinstalled and
  `src/stats/{priceStats,riskStats,types}.ts` were restored from upstream. Format **only the
  files you changed** (e.g. `npx oxfmt src/components/Foo.tsx`) and re-run
  `npx tsc --noEmit` afterwards.
- ❌ Adding `tailwind.config.js`, PostCSS config, or a second styling system.
- ❌ Installing icon/component/styling libraries.
- ❌ Using `new Date()` for "now" — use the fixed `TODAY` constant.
- ❌ Putting React into `domain/`, `stats/`, or `lib/` (keep them pure and testable-by-hand).
- ❌ Hardcoding user-visible strings — all copy goes through `useI18n()` + all three dictionaries.
- ❌ Rewording, re-ordering, or "cleaning up" upstream markup/copy — this is a fidelity port.
- ❌ Rounding corners or introducing soft/rounded shadows that break the receipt look.
- ❌ Duplicating the color palette with hardcoded hex values — always go through tokens.
- ❌ Editing `dist/` or `ipynb/`.
- ✅ New tokens → `@theme` in `src/index.css`, then note them in §1.1 here.
- ✅ New shared primitive → new file in `src/components/`; new view → `src/pages/`.
- ✅ New statistic → new `stats/*.ts` exporting a `StatModule<T>` + barrel export.
- ✅ After cloning → `npm install && npm run fetch-models` before building (the OCR models are gitignored).
- ✅ New Figma design → load the `figma-design-to-code` skill, adapt (don't paste).
