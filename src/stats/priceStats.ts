// "Value covered" statistic — price distribution + cash-gap risk.

import type { WarrantyItem } from "../domain/warranty"
import type { StatModule } from "./types"

export type PriceStats<T = unknown> = {
  median: number
  q1: number
  q3: number
  iqr: number
  fence: number
  outliers: T[]
  soon: number
  soonValue: number
  n: number
  p: number
  clusterP: number
}

/** Linear-interpolated quantile over an ascending-sorted numeric array. */
export function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * p
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base]
}

/**
 * Compute cover statistics from the currently-covered items.
 * Each entry pairs a price and status with its originating `item`, so
 * price outliers can be reported back as the original objects.
 */
export function computePriceStats<T>(
  covered: { price: number; status: string; item: T }[],
): PriceStats<T> {
  const prices = covered.map((e) => e.price).sort((a, b) => a - b)
  const median = quantile(prices, 0.5)
  const q1 = quantile(prices, 0.25)
  const q3 = quantile(prices, 0.75)
  const iqr = q3 - q1
  const fence = q3 + 1.5 * iqr
  const outliers = covered.filter((e) => e.price > fence).map((e) => e.item)
  const soon = covered.filter((e) => e.status === "soon")
  const n = covered.length
  const p = n ? soon.length / n : 0
  const clusterP =
    n > 1
      ? Math.max(0, 1 - (1 - p) ** n - n * p * (1 - p) ** (n - 1))
      : 0
  const soonValue = soon.reduce((total, entry) => total + entry.price, 0)
  return {
    median,
    q1,
    q3,
    iqr,
    fence,
    outliers,
    soon: soon.length,
    soonValue,
    n,
    p,
    clusterP,
  }
}

export const priceCoverStat: StatModule<PriceStats<WarrantyItem>> = {
  id: "price-cover",
  label: "Value covered",
  compute: (ctx) =>
    computePriceStats(
      ctx.covered.map((e) => ({
        price: e.it.price,
        status: e.status,
        item: e.it,
      })),
    ),
}
