// Core warranty domain model + enrichment pipeline.
// Everything statistical builds on top of `EnrichedItem`, so this is the
// single source of truth for item shape, dates, and status.

export type WarrantyItem = {
  id: string
  product: string
  brand: string
  category: string
  serial: string
  purchaseDate: string
  warrantyMonths: number
  price: number
  receipt: boolean
  store: string
}

export type Status = "expired" | "soon" | "active"

/** Fixed "now" so the register renders deterministically. */
export const TODAY = new Date("2026-09-10")

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function expiryDate(item: WarrantyItem): Date {
  const d = new Date(item.purchaseDate)
  d.setMonth(d.getMonth() + item.warrantyMonths)
  return d
}

export function daysLeft(item: WarrantyItem): number {
  return Math.round((expiryDate(item).getTime() - TODAY.getTime()) / MS_PER_DAY)
}

export function statusOf(days: number): Status {
  if (days < 0) return "expired"
  if (days <= 60) return "soon"
  return "active"
}

/** An item paired with its derived, cached facts. */
export type EnrichedItem = {
  it: WarrantyItem
  days: number
  status: Status
  expiry: Date
}

/** Enrich + sort by soonest-expiring first. */
export function enrichItems(items: WarrantyItem[]): EnrichedItem[] {
  return items
    .map((it) => {
      const days = daysLeft(it)
      return { it, days, status: statusOf(days), expiry: expiryDate(it) }
    })
    .sort((a, b) => a.days - b.days)
}

export type StatusCounts = {
  all: number
  active: number
  soon: number
  expired: number
}

export function countByStatus(enriched: EnrichedItem[]): StatusCounts {
  const counts: StatusCounts = {
    all: enriched.length,
    active: 0,
    soon: 0,
    expired: 0,
  }
  enriched.forEach((entry) => (counts[entry.status] += 1))
  return counts
}

/** Total value still under warranty (non-expired). */
export function coveredValue(enriched: EnrichedItem[]): number {
  return enriched
    .filter((entry) => entry.status !== "expired")
    .reduce((total, entry) => total + entry.it.price, 0)
}
