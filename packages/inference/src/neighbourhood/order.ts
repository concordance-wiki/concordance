import { byCodeUnit } from "@concordance-wiki/core";

import type { Neighbour } from "./types.js";

/** Best first: the larger count, then the lower identifier. */
export function compareNeighbours(a: Neighbour, b: Neighbour): number {
  return b.count - a.count || byCodeUnit(a.id, b.id);
}
