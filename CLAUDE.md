# CLAUDE.md — Warranty Keeper (Figma Make App)

Rules and conventions for AI agents working in this repo, with emphasis on
**integrating Figma designs via the Figma MCP server**.

> This project is a **Figma Make export** (`package.json` name: `figma-make-app`).
> It is a single-page React 19 + Vite + Tailwind v4 app called **Warranty Keeper**.
> Keep it looking like it was produced by Figma Make: minimal dependencies,
> no build config sprawl, Tailwind utilities for layout, and a tiny set of
> hand-rolled component classes in `src/index.css`.

---

## 0. Quick reference

| Concern | Answer |
|---|---|
| Language | TypeScript (strict), `.tsx` / `.ts` |
| UI framework | React 19.3 (`react`, `react-dom`) — **no** router, **no** state lib |
| Styling | Tailwind CSS **v4** via `@tailwindcss/vite` (CSS-first config, **no `tailwind.config.js`**) |
| Build | Vite 8 + `@vitejs/plugin-react`, Rolldown-based |
| Package manager | npm (`package-lock.json`) |
| Formatter | `oxfmt` (`npm run format`) — **no ESLint / Prettier / tests** |
| Entry | `index.html` → `src/main.tsx` → `src/App.tsx` |
| Tokens | `@theme` block in `src/index.css` |
| Components | Local functions inside `src/App.tsx` (no `components/` dir) |
| Icons | None — inline SVG + Unicode glyphs only |
| Assets | None in repo; fonts from Google Fonts CDN |
| Alias | `@/*` → `./src/*` (configured in `tsconfig.json` + `vite.config.ts`) |

**Golden rules for agents**

1. Do **not** add `tailwind.config.js`, PostCSS config, or CSS modules. Tailwind v4 is configured *in CSS*.
2. Do **not** add dependencies (icon packs, component libraries, styling libs) unless explicitly asked. Match the existing hand-rolled aesthetic.
3. Put new shared UI primitives as small local components/columns of `src/App.tsx` until a `src/components/` folder is explicitly requested.
4. New design tokens go in the `@theme` block in `src/index.css`; reference them via Tailwind utility names (`bg-signal`, `text-muted`, …).
5. **Do not** re-implement the Figma layer differently per-screen — extend the existing token + utility vocabulary.

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

**None.** There is no Style Dictionary, no theme switcher, no dark mode, and no
runtime theming. Tokens are compile-time CSS variables emitted by Tailwind v4.
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

There is **no `src/components/` directory and no Storybook**. All UI components are
module-local function declarations in [`src/App.tsx`](src/App.tsx), rendered by the
default-exported `App`.

Component inventory (all in `src/App.tsx`):

| Component | Lines | Role |
|---|---|---|
| `App` (default export) | 35–265 | Page shell: header, stat band, controls, list/receipt views, footer, add dialog state |
| `MonthlyRiskBand` | 267–290 | Section summarizing Poisson/Binomial risk model |
| `RiskMetric` | 292–311 | Small label + big value cell used inside `MonthlyRiskBand` |
| `Stat` | 313–342 | Stat-band cell with `accent?: "ok" \| "warn" \| "signal"` |
| `MoneyStat` | 344–495 | Clickable "Value covered" cell + breakdown popover (receipt popover w/ torn SVG edge) |
| `StatusDot` | 497–501 | 2x2 status square (signal/warn/ok) |
| `ProgressLeft` | 503–537 | Draining progress bar + time-left label (list view) |
| `ReceiptCard` | 539–676 | The hero receipt card with perf strips, barcode, risk flag |
| `RiskFlag` | 678–711 | Status band + hover-revealed recommendation |
| `AddDialog` | 713–878 | Modal form to register a new item |

Helpers: `barcodesFrom(serial)` (App.tsx:23) generates barcode bar widths.

### 2.2 Component architecture

- **Plain function components** with inline `type` props — no `React.FC`, no
  PropTypes, no forwardRef, no context except React's own `useState/useMemo`.
- Props are declared as an inline object type on the parameter:
  ```tsx
  function Stat({
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
  (`enriched`, `counts`, `covered`, `priceStats`, `risks`, `monthlyRisk`,
  `riskByItemId`). Components are otherwise stateless (they don't fetch or mutate
  the register).
- **Repeated shadow strings** are inlined verbatim on surfaces (stat band, list
  panel, receipt). They are *not* extracted to a token/class (the receipt card
  shadow *is* in `.receipt-card`). Preserve exact strings when copying.

### 2.3 Documentation / Storybook

- No Storybook, no MDX, no doc comments beyond concise `//` header comments.
- However, `vite.config.ts` contains a **Figma Make "kit" plugin**
  (`figmaMakeKitPlugin`, lines 352–403) that is designed to expose stories to the
  Figma preview grid via `window.__FIGMA__.stories` and `import.meta.glob(storiesGlob)`.
  ⚠️ **As of this writing it is dead code** — only `react()` and `tailwindcss()`
  are in the `plugins` array (line 19). If a Figma workflow needs component
  previews, the plugin must be added to `plugins` and given a `storiesGlob`
  (there are currently zero `*.stories.*` files). Coordinate before wiring it up.

---

## 3. Frameworks & Libraries

### 3.1 UI framework

React 19 with the automatic JSX runtime (`"jsx": "react-jsx"` in `tsconfig.json`).
No routing, no data-fetching, no form library, no UI kit.

```jsonc
// package.json
"dependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
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
- No path aliases are actually used in source yet (`@/…` is unused; imports are
  relative like `./domain/warranty`). You may use `@/…` if you prefer.

---

## 4. Asset Management

- **No local assets exist.** `src/` contains only `.ts`/`.tsx`/`.css`; there is no
  `src/assets`, no `public/`, and no images/videos/fonts committed.
- **Fonts** are loaded from the **Google Fonts CDN** via `@import` at the top of
  `src/index.css` (Archivo, Inter, JetBrains Mono).
- **Graphics** are generated in code, not imported:
  - the receipt torn edge is an inline `<svg>` path (App.tsx:465–488),
  - the barcode is a row of styled `<div>` bars (App.tsx:650–668),
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
  - `✓` "RECEIPT ON FILE" (App.tsx:641), `✗` "NO RECEIPT" (App.tsx:645),
    `>` chevron (App.tsx:364), `+` on the Register button (App.tsx:167),
    `✕` close (App.tsx:763).
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
  [`src/index.css`](src/index.css): `.receipt-card`, `.receipt-product`,
  `.receipt-perf-top`, `.receipt-perf-bottom`, `.receipt-dash`, plus the
  `moneyPop` keyframe animation.
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
  (App.tsx:224).
- Stat band: `grid-cols-2 lg:grid-cols-4` (App.tsx:84).
- List rows switch from stacked to `md:grid-cols-[1fr_auto_auto_auto]`
  (App.tsx:176, 186).
- Compact-label swaps via `hidden sm:inline` / `sm:hidden` (App.tsx:167–168, 248).
- Typography scales with pairs like `text-[9px] sm:text-[10px]` and
  `tracking-[0.14em] sm:tracking-[0.18em]`.

Follow this stacking pattern; do not introduce container queries or CSS `@media`
blocks unless unavoidable.

---

## 7. Project Structure

```
Math/                         # repo root (not currently a git repo)
├── index.html                # Vite shell; contains Figma slot comments
├── package.json              # "figma-make-app", scripts: dev/build/preview/format
├── tsconfig.json             # strict TS, jsx: react-jsx, @/* alias
├── vite.config.ts            # Vite config + Figma Make plugins (see note below)
├── .vscode/mcp.json          # Figma MCP server registration (HTTP)
├── dist/                     # build output (generated; do not hand-edit)
├── ipynb/                    # unrelated Kazakh statistics coursework (ignore)
└── src/
    ├── main.tsx              # React root; imports ./index.css
    ├── App.tsx               # ALL UI components + page layout
    ├── index.css             # tokens (@theme), globals, component classes
    ├── vite-env.d.ts         # /// <reference types="vite/client" />
    ├── domain/               # pure domain model (no React)
    │   ├── warranty.ts       # WarrantyItem, Status, EnrichedItem, enrich/count/covered
    │   └── seed.ts           # SEED: WarrantyItem[] demo data
    ├── lib/
    │   └── format.ts         # gbp(), fmtDate(), humanLeft()
    └── stats/                # pure statistics modules (no React)
        ├── index.ts          # public barrel for the stats layer
        ├── types.ts          # StatContext, StatModule<T>
        ├── context.ts        # buildStatContext()
        ├── priceStats.ts     # priceCoverStat / computePriceStats / quantile
        ├── riskStats.ts      # warrantyRiskStat / computeWarrantyRisk
        └── monthlyRiskStats.ts # monthlyRiskStat / computeMonthlyRisk
```

### 7.1 Architectural patterns to follow

- **Layered, React-free domain + stats.** `domain/` and `stats/` are pure
  TypeScript; only `App.tsx` touches React. Presentation strings/logic stay in
  `App.tsx` and `lib/format.ts` (`lib/format.ts` explicitly says "no domain logic here").
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
  built once per register change.
- **Deterministic rendering.** `TODAY` is a fixed date (`2026-09-10`,
  `domain/warranty.ts:21`) so the UI renders identically every run. Don't replace
  it with `new Date()`.
- **No feature folders yet.** If the app grows, introduce `src/components/` and
  `src/features/` deliberately and document it here — don't scatter one-off
  directories.
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
     and place new shared primitives in `src/App.tsx`.
3. Avoid introducing libraries to match a design; reimplement with Tailwind
   utilities + inline SVG.
4. Verify responsive behavior with the mobile-first breakpoint pattern in §6.3.

### 8.3 Code → design (pushing UI into Figma)

- `search_design_system` / `get_libraries` first; reuse existing components and
  tokens before creating anything new.
- For a full page, pair `generate_figma_design` (pixel capture) with `use_figma`
  (rebuild from design-system primitives), then remove the capture reference.
- Mirror the token names in §1.1 into the Figma library so the two stay aligned.

### 8.4 Figma Make hosting hooks (important caveats)

- `vite.config.ts` defines four Figma Make plugins — `figmaSiteConfiguration`
  (applies `.figma/make/site.json` to the HTML shell), `figmaErrorOverlayReplay`,
  `figmaReactRefreshBoundaryFallback`, and `figmaMakeKitPlugin` — but **none are
  currently registered** in the `plugins: [react(), tailwindcss()]` array. They are
  inert. Re-enable deliberately and document it; do not assume the
  `/.figma/make/kit.html` story route or `site.json` metadata are active.
- `index.html` contains Figma slot comments (`<!-- figma:lang -->`,
  `<!-- figma:title -->`, `<!-- figma:head-start -->`, `<!-- figma:body-start -->`,
  …). Preserve these markers when editing the shell — the (inactive) site plugin
  substitutes them.
- `base` honors `FIGMA_PUBLIC_URL`; dev/preview port honors `PORT` and
  `FIGMA_DEV_SERVER_HOST`.

---

## 9. Gotchas checklist

- ❌ Adding `tailwind.config.js`, PostCSS config, or a second styling system.
- ❌ Installing icon/component/styling libraries.
- ❌ Using `new Date()` for "now" — use the fixed `TODAY` constant.
- ❌ Putting React into `domain/` or `stats/` (keep them pure and testable-by-hand).
- ❌ Rounding corners or introducing soft/rounded shadows that break the receipt look.
- ❌ Duplicating the color palette with hardcoded hex values — always go through tokens.
- ❌ Editing `dist/` or `ipynb/`.
- ✅ New tokens → `@theme` in `src/index.css`, then note them in §1.1 here.
- ✅ New shared primitive → local component in `src/App.tsx` (until a `components/` dir exists).
- ✅ New statistic → new `stats/*.ts` exporting a `StatModule<T>` + barrel export.
- ✅ New Figma design → load the `figma-design-to-code` skill, adapt (don't paste).
