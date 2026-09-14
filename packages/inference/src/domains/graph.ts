import { byCodeUnit } from "../neighbourhood/order.js";
import type { DomainEdge, DomainNode } from "./types.js";

/** Every node with its distinct neighbours in identifier order; an edge naming an unknown node or joining a node to itself is dropped. */
export type DomainGraph = ReadonlyMap<string, readonly string[]>;

export function buildGraph(
  nodes: readonly DomainNode[],
  edges: readonly DomainEdge[],
): DomainGraph {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const { a, b } of edges) {
    const ofA = adjacency.get(a);
    const ofB = adjacency.get(b);
    if (ofA === undefined || ofB === undefined || a === b) continue;
    ofA.add(b);
    ofB.add(a);
  }
  const graph = new Map<string, readonly string[]>();
  for (const [id, neighbours] of adjacency) graph.set(id, [...neighbours].sort(byCodeUnit));
  return graph;
}

/** The distance from `start` to every node within `radius`, the start at zero. */
export function distancesFrom(
  graph: DomainGraph,
  start: string,
  radius: number,
): Map<string, number> {
  const distances = new Map<string, number>([[start, 0]]);
  let frontier = [start];
  for (let distance = 1; distance <= radius && frontier.length > 0; distance += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of graph.get(id) ?? []) {
        if (distances.has(neighbour)) continue;
        distances.set(neighbour, distance);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return distances;
}
