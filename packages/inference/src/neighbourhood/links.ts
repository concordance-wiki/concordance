import { compareLinks, type Link } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

import type { Neighbourhood } from "./types.js";

interface Pair {
  from: string;
  to: string;
  count: number;
}

/**
 * One undirected `related` link per neighbour pair at the `cooccurrence` confidence of the
 * profile, the number of shared paragraphs as its provenance. A pair is listed by either of its
 * nodes or by both; when the two rows disagree, a trim reset one of them and the larger count is
 * the closer to the truth. The relation typing step may refine `related` from the type pair.
 */
export function cooccurrenceLinks(
  neighbourhood: Neighbourhood,
  options: { profile: Profile },
): Link[] {
  const confidence = options.profile.confidence.cooccurrence ?? 0.4;
  const pairs = new Map<string, Pair>();
  for (const [id, neighbours] of neighbourhood.nodes) {
    for (const neighbour of neighbours) {
      const [from, to] = id < neighbour.id ? [id, neighbour.id] : [neighbour.id, id];
      const key = `${from} ${to}`;
      const existing = pairs.get(key);
      if (existing === undefined) {
        pairs.set(key, { from, to, count: neighbour.count });
      } else {
        existing.count = Math.max(existing.count, neighbour.count);
      }
    }
  }
  return [...pairs.values()]
    .map(({ from, to, count }): Link => ({
      from,
      to,
      relation: "related",
      attributes: {},
      confidence,
      provenance: [{ method: "cooccurrence", confidence, count }],
    }))
    .sort(compareLinks);
}
