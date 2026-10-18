// Statistics registry — the public surface for the stats layer.
// Register each new statistic here so consumers can discover it.

export type { StatContext, StatModule } from "./types"
export { buildStatContext } from "./context"
export {
  priceCoverStat,
  computePriceStats,
  quantile,
  type PriceStats,
} from "./priceStats"
export {
  warrantyRiskStat,
  computeWarrantyRisk,
  type RiskLevel,
  type WarrantyRisk,
} from "./riskStats"
