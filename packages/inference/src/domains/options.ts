import type { InferenceConfig } from "@concordance-wiki/core";

import type { EmergentDomainsOptions } from "./types.js";

/** `inference.domains` of the configuration; undefined while the key is absent, and the step does not run. */
export function emergentDomainsOptions(
  inference?: InferenceConfig,
): EmergentDomainsOptions | undefined {
  const domains = inference?.domains;
  if (domains === undefined) return undefined;
  return {
    minNeighbours: domains.min_neighbours,
    ...(domains.max_neighbours === undefined ? {} : { maxNeighbours: domains.max_neighbours }),
    radius: domains.radius,
    assign: domains.assign ?? false,
  };
}
