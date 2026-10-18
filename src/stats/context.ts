import type { EnrichedItem } from "../domain/warranty"
import type { StatContext } from "./types"

/** Build the shared stat context once per register change. */
export function buildStatContext(enriched: EnrichedItem[]): StatContext {
  return {
    all: enriched,
    covered: enriched.filter((e) => e.status !== "expired"),
  }
}
