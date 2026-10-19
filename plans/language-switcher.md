# Warranty Keeper — EN / RU / KZ language switcher

## Goal
Translate the whole UI into English, Russian and Kazakh, with a switcher in the header that you barely notice: small, low-contrast, and styled like the existing header type. Picking a language changes everything at once (labels, dates, durations, counts, messages, aria labels) and is remembered between visits.

## Decisions (already settled)
- **Scope:** every UI string on Register, Archive, RegisterDialog/scan flow, stats popover, risk flags, skeleton/error states, footer, and aria-labels/titles/placeholders.
- **Not translated:** user and seed data (product, brand, store, serial), brand lists and OCR parsing in `src/scan/parseReceipt.ts` (the OCR model is English-only), and the dev-only `src/dev/StateDemo.tsx`. The currency stays `£` because prices are stored in GBP. Only the number grouping follows the locale.
- **Labels:** `EN · RU · KZ`. Internal language codes are `en | ru | kk` (ISO 639-1). `kk` is used for `<html lang>` and Intl; the visible label stays `KZ`, as requested.
- **Default:** use the saved choice in `localStorage["warranty-keeper:lang"]`. Without one, `navigator.language` starting with `ru` gives `ru`, `kk` gives `kk`, and anything else gives `en`.
- **No new dependency.** A small typed dictionary and a React context are enough for about 150 strings.

## Switcher design (header, quiet)
- Goes in the right-hand meta column in `App.tsx`, on the **same row as the date** and to its left: `EN · RU · KZ   10 SEP 2026`. The header stays the same height and the status line below is unchanged.
- Type matches the nav: `font-mono`, 8px mobile / 9px sm+, uppercase, `tracking-[0.18em]`. Inactive codes are `text-muted opacity-40`. The active code is `text-ink` with no underline or fill. On group hover/focus-within, inactive codes go to `opacity-80`. The `·` separators are `opacity-50`, the same as the nav.
- Markup: `<div role="group" aria-label={t("lang.label")}>` holding three `<button aria-pressed lang="en|ru|kk">`. Each button has an accessible name in its own language: "English", "Русский", "Қазақша". Hit area is about 24px tall through vertical padding, with no visual change. Focus-visible gets the existing 2px ink outline.
- Changing language swaps the text in place without animation. The `meta-in` status line keeps its own key-based animation.

## Architecture
New folder `src/i18n/`:
- `dict/en.ts`: the source dictionary as a nested `const` object. Its type `Dict` is derived from it.
- `dict/ru.ts`, `dict/kk.ts`: `export default { ... } satisfies Dict`, so a missing key is a type error.
- `index.tsx`:
  - `type Lang = "en" | "ru" | "kk"`; `LANGS = [{ code: "en", label: "EN", name: "English" }, { code: "ru", label: "RU", name: "Русский" }, { code: "kk", label: "KZ", name: "Қазақша" }]`.
  - `LOCALE: Record<Lang, string> = { en: "en-GB", ru: "ru-RU", kk: "kk-KZ" }`.
  - `I18nProvider` holds `lang` state, saves it to localStorage, and sets `document.documentElement.lang` in an effect.
  - `useI18n()` returns `{ lang, setLang, t, fmt }`.
  - `t(key: DotPath<Dict>, vars?: Record<string, string | number>)`: dotted-key lookup with `{name}` interpolation. It falls back to `en` if a value is missing at runtime.
  - Plurals: a value can be `{ one, few?, many?, other }`, chosen with `new Intl.PluralRules(locale).select(n)` when `vars.count` is set. This matters for ru ("1 запись / 3 записи / 5 записей").
  - `fmt` holds locale-bound formatters (below).
- `src/main.tsx`: wrap `<App />` in `<I18nProvider>`.

### Formatting (`src/lib/format.ts`)
Change to locale-aware functions without hardcoded English, so callers use `fmt.*` from `useI18n()`:
- `fmtDate(d, locale)`: `toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })`.
- `money(n, locale)`: `£` + `Math.round(n).toLocaleString(locale)`. This replaces `gbp` and the inline `` `£${x.toLocaleString()}` `` calls in App, Archive and RegisterDialog.
- `humanLeft(days, units)`: same thresholds as now, with unit suffixes from the dictionary (`en: d/mo/y/ago`, `ru: д/мес/г/назад`, `kk: күн/ай/ж/бұрын`). Word order comes from a template key (for example ru `"{n} д назад"`).
- Warranty length `yr/mo` on receipt cards uses the same unit keys.
- Month names: Intl data for `kk-KZ` is missing or partial in some engines, so month names (long, for Archive box labels) come from a 12-item array in each dictionary instead of Intl. `fmtDate` also gets a fallback: if `Intl.DateTimeFormat.supportedLocalesOf("kk-KZ")` is empty, build `DD <short month from dict> YYYY` by hand.
- `groupByMonth` in `domain/warranty.ts` keeps its `key`. Archive already builds labels from `MONTHS[key]`, so swap that constant for `t`'s months array and leave the domain code alone.

### Domain strings → keys (display stays out of domain code)
- **Risk:** `RiskFlag` already switches on `risk.level`. Render `t("risk.{level}.label")` and `t("risk.{level}.rec")` instead of `risk.recommendation`. The `recommendation` field in `stats/riskStats.ts` stays as an English fallback.
- **Repo errors:** `RepoError` already has `code`. In App and RegisterDialog, map `LOAD_FAILED` to `t("errors.load")` and `SAVE_FAILED` to `t("errors.save")`. Other errors use `t("errors.generic")`. Raw `e.message` is no longer shown to users.
- **OCR/reader errors** (download failure from `ocr.worker.ts`): show `t("scan.readerDownloadFailed")` wherever the reader error is displayed, and drop the worker's English message.
- **Categories:** stored values stay English (`"Electronics"`, …) so saved data and the risk priors still work. Show them with `t("category.{value}")`, falling back to the raw value for unknown ones. The `<select>` in RegisterDialog keeps `value` English and translates only the option text.
- **Statuses/filters:** `t("filter.all|active|soon|expired")`, `t("archive.filter.all|filed|missing")`, `t("status.expired")` (replaces the hardcoded `"EXPIRED"`).

## String inventory (key groups)
`nav` (register, archive) · `meta` (loading, error, filed {count}, onFile {count}) · `stats` (total, active, expiringSoon, valueCovered, breakdown title, median, coreRange, iqr, outliers/none/above {fence}, cashGap {pct}, cashGapDetail {soon}/{n}/{p}, closeBreakdown) · `controls` (list, receipt, listView, receiptView, registerItem, add) · `list` (product, purchased, expires, timeLeft, noReceipt, empty) · `receipt` (purchased, expires, warranty, value, receiptOnFile, noReceipt) · `risk.*` · `states` (loadingRecords, printError, registerNotRead, untouched, tryAgain) · `footer` (records {count}) · `archive` (search, searchPlaceholder, clear, ctrlK, filter labels, filed, missing, nothingFiled {query}, noMatch, clearSearch, newerYears {years}, olderYears {years}, shelves, boxContents {label}, preview fields store/purchased/expires/cover/value/serial, closePreview, loadingReceipts) · `scan` (steps Scan/Check, tiles Take photo/Camera, Upload file/Photo or screenshot, drop/paste hint, fields-fill hint, reader states preparing {pct}/warming/offline/on-device {backend}, finding text, camera states, unsupported format, no text, not a receipt, readIn {s}/notRead, field labels incl. "Price (£)", productRequired, printing, retry, register) · `category.*` · `units.*` · `months[12]` · `lang` (label, en/ru/kk names) · `errors.*`.

Translation quality: natural, short, receipt-like UI wording, not literal. The brand name "WARRANTY KEEPER" stays in English in every language (wordmark).

## Typography: Cyrillic coverage
Archivo (display) has **no Cyrillic**. Inter and JetBrains Mono do cover Cyrillic and Cyrillic-ext, including the Kazakh letters ә ғ қ ң ө ұ ү һ і.
- In `src/index.css`, add a Google import for **Inter Tight** `wght@700;800` (it supports cyrillic-ext), placed before `@import 'tailwindcss'` with the other imports.
- Change `--font-display` to `'Archivo', 'Inter Tight', sans-serif`. Browser per-glyph fallback keeps Latin in Archivo and draws Cyrillic in Inter Tight at the same weight, so English looks exactly as it does now.

## Layout hardening for longer strings
Russian and Kazakh run about 20–40% longer. Fix the tight spots:
- Register filter segmented control: on sm+, change `sm:w-[104px]` to `sm:min-w-[104px] sm:w-auto`. Keep the 4-column mobile grid and use short dictionary forms (ru: "Все / Актив. / Скоро / Истекли"; kk: "Барлығы / Белсенді / Жақында / Өткен"). The labels already have `whitespace-nowrap`.
- Stat labels: allow two lines (no truncation). The stat band height stays even because each cell's padding is fixed.
- Register button: keep the mobile "Add" short form in each language.
- Receipt card data rows already use `justify-between gap-3`. Spot-check that the KZ labels fit.
- Header right column: language row + date must fit at 320px; the date is already short.

## Files touched
- New: `src/i18n/index.tsx`, `src/i18n/dict/en.ts`, `src/i18n/dict/ru.ts`, `src/i18n/dict/kk.ts`, `src/i18n/LanguageSwitcher.tsx` (default export).
- Edit: `src/main.tsx` (provider), `src/App.tsx` (all strings, switcher, formatter calls, error mapping), `src/pages/Archive.tsx`, `src/scan/RegisterDialog.tsx`, `src/lib/format.ts`, `src/index.css` (font).
- Unchanged: domain, stats math, scan engine/parser, seed, StateDemo.

## Edge cases
- localStorage unavailable: wrap read and write in try/catch and keep the language in memory only.
- Unknown saved value: ignore it and use navigator detection.
- Search in Archive stays case-insensitive on raw data and does not depend on language.
- Switching language while RegisterDialog is open: the dialog re-renders in the new language, and form state is kept because it lives in the dialog's own state.
- `aria-live` status line: changing language changes the text, which may be announced once. That is acceptable.

## Verification
1. `pnpm build` (runs the TypeScript check, so a missing ru/kk key fails because of `satisfies Dict`).
2. In the preview, for each of EN / RU / KZ:
   - Register in receipt and list views, all four filters, Value-covered popover, risk flag hover, empty filter state.
   - Archive: search with no results, filters, box open, receipt preview, closet arrows (aria).
   - RegisterDialog: choose step, camera-blocked state, the check form with categories, and the save error (via StateDemo "Save error").
   - Load error and loading skeleton through StateDemo.
   - At 375px and desktop widths: no overflow in the filter bar, stat band, header and receipt cards. Cyrillic headings render in Inter Tight with no tofu or system-font jumps.
3. Reload to confirm the language is remembered. Clear storage and use a ru browser locale to confirm detection.
4. `grep` the touched TSX files for leftover user-facing English literals.
