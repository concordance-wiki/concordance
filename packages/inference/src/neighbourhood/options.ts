import type { InferenceConfig } from "@concordance-wiki/core";

import type { NeighbourhoodOptions } from "./types.js";

const DEFAULT_K = 50;

/** `inference.neighbours.k` of the configuration, 50 when unset. */
export function neighbourhoodOptions(inference?: InferenceConfig): NeighbourhoodOptions {
  return { k: inference?.neighbours?.k ?? DEFAULT_K };
}
