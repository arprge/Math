// Presentation-only formatting helpers. No domain logic here.
// Callers normally use the locale-bound versions from `useI18n().fmt`.

type Units = {
  days: string
  months: string
  years: string
  yearsMonths: string
  ago: string
  warrantyYears: string
  warrantyMonths: string
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))

/** Prices are stored in GBP; only the digit grouping follows the locale. */
export const money = (n: number, locale?: string) =>
  `£${Math.round(n).toLocaleString(locale)}`

/**
 * `10 Sep 2026`. With a locale, Intl formats it; without one (ru/kk, where
 * engines add suffixes or lack data) the date is built from `monthsShort`.
 */
export function fmtDate(
  d: Date,
  locale: string | null = "en-GB",
  monthsShort?: readonly string[],
): string {
  if (locale || !monthsShort) {
    return d.toLocaleDateString(locale ?? "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }
  const day = String(d.getDate()).padStart(2, "0")
  return `${day} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`
}

/** Compact human-readable duration for a day count. */
export function humanLeft(days: number, u: Units): string {
  if (days < 0) return fill(u.ago, { n: Math.abs(days) })
  if (days < 45) return fill(u.days, { n: days })
  if (days < 365) return fill(u.months, { n: Math.round(days / 30.4) })
  const years = Math.floor(days / 365)
  const months = Math.round((days % 365) / 30.4)
  return months
    ? fill(u.yearsMonths, { y: years, m: months })
    : fill(u.years, { n: years })
}

/** Warranty term, e.g. `2yr` / `6mo`. */
export const warrantyLength = (months: number, u: Units) =>
  months >= 12
    ? fill(u.warrantyYears, { n: months / 12 })
    : fill(u.warrantyMonths, { n: months })
