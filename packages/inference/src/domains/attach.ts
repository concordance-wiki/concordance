import { byCodeUnit } from "../neighbourhood/order.js";
import { buildGraph, distancesFrom } from "./graph.js";
import { selectPivots } from "./pivots.js";
import type {
  Attachment,
  EmergentDomains,
  EmergentDomainsInput,
  EmergentDomainsOptions,
} from "./types.js";

/**
 * The pivots of the graph and the attachable notes within `radius` of one, each attached to
 * its closest pivot; at equal distance the pivot of highest degree wins, then the first in
 * code-unit order. The same graph gives the same result whatever the order of its nodes and edges.
 */
export function proposeEmergentDomains(
  input: EmergentDomainsInput,
  options: EmergentDomainsOptions,
): EmergentDomains {
  const graph = buildGraph(input.nodes, input.edges);
  const candidates = new Set(input.nodes.filter((node) => node.candidate).map((node) => node.id));
  const pivots = selectPivots(candidates, graph, options.minNeighbours, options.maxNeighbours);
  const closest = new Map<string, Attachment>();
  // Pivots are visited best first, so a later pivot only wins a note at a strictly shorter distance.
  for (const pivot of pivots) {
    for (const [id, distance] of distancesFrom(graph, pivot.id, options.radius)) {
      const current = closest.get(id);
      if (current === undefined || distance < current.distance) {
        closest.set(id, { id, pivot: pivot.id, distance });
      }
    }
  }
  const attachments = input.nodes
    .filter((node) => node.attachable)
    .flatMap((node) => {
      const attachment = closest.get(node.id);
      return attachment === undefined ? [] : [attachment];
    })
    .sort((a, b) => byCodeUnit(a.id, b.id));
  return { pivots, attachments };
}
