# Receipt Archive page

## Goal
Add a second page, **Receipt Archive**, alongside the existing Product Register. Same design code: monospaced caps labels, `border-line` hairlines, `bg-receipt` surfaces with the existing soft inset shadows, ink-filled active states. No new colors, fonts, icons libraries, or decorative flourishes.

## Decisions (confirmed)
- **Page switch:** typographic tabs in the header.
- **Layout:** chronological ledger + preview drawer.

## Structure
- `src/App.tsx`: add `type Page = "register" | "archive"` and `const [page, setPage] = useState<Page>("register")`. Keep `items`/`enriched`/`riskByItemId` in `App` so both pages share data (newly registered items show up in the archive).
- Move the current `<main>` body into a `RegisterPage` component in the same file (pure move, no behavior change) so `App` renders `page === "register" ? <RegisterPage …/> : <ArchivePage …/>`.
- New file `src/pages/Archive.tsx` (default export `ArchivePage`), props: `enriched: EnrichedItem[]`, `riskByItemId`, and a `renderReceipt(item)` callback that returns the existing `ReceiptCard` (avoids moving ReceiptCard out of App.tsx).
- `src/domain/warranty.ts`: add `groupByMonth(enriched): { key: string; label: string; items: EnrichedItem[] }[]`, sorted newest purchase first; label like `SEP 2026`.

## Header tabs
- Replace the `Product Register` sublabel under `WARRANTY KEEPER` with two tab buttons: `REGISTER` · `ARCHIVE`, same 8–9px mono uppercase `tracking-[0.22em]`.
- Active: `text-ink` with a 1px ink underline (`border-b border-ink`). Inactive: `text-muted hover:text-ink`. `role="tablist"`/`role="tab"` + `aria-selected`.
- Right-hand meta: on Archive, second line reads `{n} receipts filed` instead of `records on file`.

## Archive page
**Controls row** (right-anchored, same as register controls):
- Search input (product, brand, store, serial), bordered, `bg-receipt`, mono 10px uppercase placeholder `SEARCH RECEIPTS`.
- Segmented control reusing filter styling: `ALL · FILED · MISSING` (by `item.receipt`), with counts.

**Ledger** (single bordered `bg-receipt` sheet):
- Month group header rows: mono caps label (`SEP 2026`) left, item count + month total `£` right, hairline below.
- Rows: date (`DD MMM`, mono) · product + brand · store · serial (mono, muted, hidden < sm) · price right-aligned tabular · `StatusDot`. Missing-receipt rows show a muted `NO RECEIPT` mono tag in place of the serial.
- Row hover: `bg-white`; selected row: ink left rule (2px) + `bg-white`. Rows are buttons; Up/Down arrows move selection, Enter opens, Esc closes.
- Footer rule: total archived value.
- Empty state (no search results): one mono line `NO RECEIPTS MATCH “query”` + a `CLEAR` text button.

**Preview drawer**:
- Desktop (≥ lg): right-side panel, `w-[380px]`, slides in (`translate-x` 200ms ease-out), ledger stays visible and narrows; renders the existing `ReceiptCard` for the selected item plus a small meta block (purchased, expires, days left, store).
- Mobile: bottom sheet, `max-h-[85vh]`, scrollable, with a scrim (`bg-ink/20`); tap scrim or `CLOSE` to dismiss.
- Close button: mono `CLOSE ×` text button. Focus moves to drawer on open, returns to row on close.
- Respect `prefers-reduced-motion` (no slide, just appear).

## Edge cases
- Items with `receipt: false` still listed (they're archive gaps worth seeing), filterable via MISSING.
- Selected item filtered out by search/filter → close drawer.
- Switching pages resets drawer selection; search/filter state is local to ArchivePage.

## Verification
- Visual check in the preview: tab switching, grouping order, search, filter counts, drawer on desktop and mobile widths, keyboard navigation.
- Register page unchanged after the `RegisterPage` extraction (stats, filters, List/Receipt toggle, Add dialog work).
- Run `pnpm build` once at the end since this spans multiple files.
