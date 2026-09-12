import { byCodeUnit } from "./order.js";
import type { Neighbour, Neighbourhood } from "./types.js";

/** The `neighbours` block of `model.json`: keys in identifier order, each list best first. */
export function neighbourhoodToModel(neighbourhood: Neighbourhood): Record<string, Neighbour[]> {
  const block: Record<string, Neighbour[]> = {};
  for (const [id, neighbours] of [...neighbourhood.nodes].sort(([a], [b]) => byCodeUnit(a, b))) {
    block[id] = neighbours.map((neighbour) => ({ ...neighbour }));
  }
  return block;
}
