// Presentation-only formatting helpers. No domain logic here.

export const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Compact human-readable duration for a day count. */
export function humanLeft(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`
  if (days < 45) return `${days}d`
  if (days < 365) return `${Math.round(days / 30.4)}mo`
  const years = Math.floor(days / 365)
  const months = Math.round((days % 365) / 30.4)
  return months ? `${years}y ${months}mo` : `${years}y`
}
