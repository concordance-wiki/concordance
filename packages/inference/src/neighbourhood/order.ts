import type { Neighbour } from "./types.js";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
export function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Best first: the larger count, then the lower identifier. */
export function compareNeighbours(a: Neighbour, b: Neighbour): number {
  return b.count - a.count || byCodeUnit(a.id, b.id);
}
