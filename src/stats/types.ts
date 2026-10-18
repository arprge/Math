import type { EnrichedItem } from "../domain/warranty"

/**
 * The shared input every statistic receives. Pre-slices the common
 * groupings so individual stats don't each re-filter the register.
 * Add new derived slices here as more statistics need them.
 */
export type StatContext = {
  /** Every item, soonest-expiring first. */
  all: EnrichedItem[]
  /** Non-expired items — the pool most value/risk stats operate on. */
  covered: EnrichedItem[]
}

/**
 * A self-contained statistic. Each feature exports one of these; the UI
 * calls `compute(ctx)` and renders the typed result. This is the seam
 * that keeps adding statistics a one-file change.
 */
export type StatModule<T,> = {
  /** Stable identifier, e.g. "price-cover". */
  id: string
  /** Human label for headers/menus. */
  label: string
  compute: (ctx: StatContext) => T
}
