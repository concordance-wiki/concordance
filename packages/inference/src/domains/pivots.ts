import { byCodeUnit } from "../neighbourhood/order.js";
import type { DomainGraph } from "./graph.js";
import type { Pivot } from "./types.js";

/** Largest degree first, then the lower identifier. */
export function comparePivots(a: Pivot, b: Pivot): number {
  return b.degree - a.degree || byCodeUnit(a.id, b.id);
}

/** The candidates whose degree reaches `minNeighbours`, best first. */
export function selectPivots(
  candidates: ReadonlySet<string>,
  graph: DomainGraph,
  minNeighbours: number,
): Pivot[] {
  const pivots: Pivot[] = [];
  for (const [id, neighbours] of graph) {
    if (candidates.has(id) && neighbours.length >= minNeighbours) {
      pivots.push({ id, degree: neighbours.length });
    }
  }
  return pivots.sort(comparePivots);
}
