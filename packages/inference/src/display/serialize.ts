import { byCodeUnit } from "../neighbourhood/order.js";
import type { DisplayedNeighbour, DisplayedNeighbourhood } from "./types.js";

/** The `displayed_neighbourhood` block of `model.json`: keys in identifier order, each list best first. */
export function displayedNeighbourhoodToModel(
  neighbourhood: DisplayedNeighbourhood,
): Record<string, DisplayedNeighbour[]> {
  const block: Record<string, DisplayedNeighbour[]> = {};
  for (const [id, neighbours] of [...neighbourhood].sort(([a], [b]) => byCodeUnit(a, b))) {
    block[id] = neighbours.map((neighbour) => ({ ...neighbour }));
  }
  return block;
}
