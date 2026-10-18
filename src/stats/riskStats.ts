// Bayesian warranty-breakdown risk. Inputs and outputs stay deliberately
// presentation-free so the register can decide how to communicate the result.

import type { WarrantyItem } from "../domain/warranty"
import type { StatModule } from "./types"

export type RiskLevel = "low" | "watch" | "high" | "expired"

export type WarrantyRisk = {
  item: WarrantyItem
  score: number
  level: RiskLevel
  recommendation: string
}

const categoryRates: Record<string, number> = {
  Electronics: 0.16,
  Appliance: 0.22,
  Wearable: 0.14,
  Furniture: 0.08,
  Vehicle: 0.2,
  Other: 0.13,
}

// Small, conservative calibration priors. An unknown brand falls back to its
// category prior, so a newly registered item never gets a fabricated penalty.
const brandRates: Record<string, number> = {
  Apple: 0.12,
  Bosch: 0.2,
  Sony: 0.17,
  Dyson: 0.19,
  Garmin: 0.15,
  "Herman Miller": 0.07,
}

const categoryRate = (category: string) => categoryRates[category] ?? 0.13

/**
 * Posterior mean over a category prior, a light brand calibration, and a
 * time-to-expiry observation. The latter raises service priority as the claim
 * window closes; it is intentionally capped so it cannot dominate the prior.
 */
export function computeWarrantyRisk(
  item: WarrantyItem,
  days: number,
): WarrantyRisk {
  if (days < 0) {
    return {
      item,
      score: 0,
      level: "expired",
      recommendation: "Warranty ended — archive service history.",
    }
  }

  const category = categoryRate(item.category)
  const brand = brandRates[item.brand] ?? category
  const urgency = 1 - Math.min(Math.max(days, 0), 180) / 180
  const timeLikelihood = 0.05 + urgency * 0.31

  const priorStrength = 18
  const brandStrength = 5
  const timeStrength = 4
  const alpha =
    category * priorStrength + brand * brandStrength + timeLikelihood * timeStrength
  const score = alpha / (priorStrength + brandStrength + timeStrength)

  if (score >= 0.24) {
    return {
      item,
      score,
      level: "high",
      recommendation: "Book a service diagnostic before cover ends.",
    }
  }
  if (score >= 0.16) {
    return {
      item,
      score,
      level: "watch",
      recommendation: "Plan a diagnostic while cover is still active.",
    }
  }
  return {
    item,
    score,
    level: "low",
    recommendation: "No diagnostic needed yet — keep the receipt ready.",
  }
}

export const warrantyRiskStat: StatModule<WarrantyRisk[]> = {
  id: "warranty-risk",
  label: "Warranty risk",
  compute: (ctx) => ctx.all.map(({ it, days }) => computeWarrantyRisk(it, days)),
}
