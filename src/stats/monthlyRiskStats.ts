import type { EnrichedItem } from "../domain/warranty"
import { computeWarrantyRisk } from "./riskStats"
import type { StatModule } from "./types"

export type MonthlyRiskStats = {
    items: number
    averageProbability: number
    poissonLambda: number
    poissonZero: number
    poissonAtLeastOne: number
    binomialAtLeastOne: number
    expectedBreakdowns: number
    expectedCost: number
    reserveCost: number
}

const REPAIR_COST_RATE = 0.35
const INSPECTION_COST = 25

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max)

/** Monthly independent-event approximation for covered items. */
export function computeMonthlyRisk(enriched: EnrichedItem[]): MonthlyRiskStats {
    const covered = enriched.filter((entry) => entry.status !== "expired")
    const probabilities = covered.map(({ it, days }) => {
        const annualScore = computeWarrantyRisk(it, days).score
        // Monthly probability: p_i = r_i / 12, where r_i is the annual risk.
        return clamp(annualScore / 12, 0, 0.25)
    })
    // Expected repair cost for item i: C_i = 0.35 * price_i + 25.
    const costs = covered.map(
        ({ it }) => it.price * REPAIR_COST_RATE + INSPECTION_COST,
    )

    // Poisson parameter: lambda = sum(i=1..n) p_i.
    const poissonLambda = probabilities.reduce((sum, p) => sum + p, 0)

    // P(X = 0) = exp(-lambda), for X ~ Poisson(lambda).
    const poissonZero = Math.exp(-poissonLambda)

    // Mean monthly probability: p_bar = lambda / n.
    const averageProbability = probabilities.length
        ? poissonLambda / probabilities.length
        : 0

    // Expected monthly cost: E[C] = sum(i=1..n) p_i * C_i.
    const expectedCost = probabilities.reduce(
        (sum, probability, index) => sum + probability * costs[index],
        0,
    )

    // Approximate 95% Poisson count reserve:
    // k_95 = ceil(lambda + 1.645 * sqrt(lambda)).
    const reserveBreakdowns = Math.ceil(
        poissonLambda + 1.645 * Math.sqrt(poissonLambda),
    )
    const averageCost = costs.length
        ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length
        : 0

    return {
        items: covered.length,
        averageProbability,
        poissonLambda,
        poissonZero,
        // P(X >= 1) = 1 - P(X = 0) = 1 - exp(-lambda).
        poissonAtLeastOne: 1 - poissonZero,
        // P(Y >= 1) = 1 - (1 - p_bar)^n, for Y ~ Binomial(n, p_bar).
        binomialAtLeastOne: 1 - Math.pow(1 - averageProbability, covered.length),
        expectedBreakdowns: poissonLambda,
        expectedCost,
        // Reserve cost = k_95 * mean(C_i).
        reserveCost: reserveBreakdowns * averageCost,
    }
}

export const monthlyRiskStat: StatModule<MonthlyRiskStats> = {
    id: "monthly-risk",
    label: "Monthly breakdown risk",
    compute: (ctx) => computeMonthlyRisk(ctx.all),
}