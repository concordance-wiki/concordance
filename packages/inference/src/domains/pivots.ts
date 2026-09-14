import { byCodeUnit } from "../neighbourhood/order.js";
import type { DomainGraph } from "./graph.js";
import type { Pivot } from "./types.js";

/** Largest degree first, then the lower identifier. */
export function comparePivots(a: Pivot, b: Pivot): number {
  return b.degree - a.degree || byCodeUnit(a.id, b.id);
}

/** The candidates whose degree reaches `minNeighbours` without exceeding `maxNeighbours`, best first: a hub the whole corpus cites names no domain. */
export function selectPivots(
  candidates: ReadonlySet<string>,
  graph: DomainGraph,
  minNeighbours: number,
  maxNeighbours = Number.POSITIVE_INFINITY,
): Pivot[] {
  const pivots: Pivot[] = [];
  for (const [id, neighbours] of graph) {
    if (
      candidates.has(id) &&
      neighbours.length >= minNeighbours &&
      neighbours.length <= maxNeighbours
    ) {
      pivots.push({ id, degree: neighbours.length });
    }
  }
  return pivots.sort(comparePivots);
}
