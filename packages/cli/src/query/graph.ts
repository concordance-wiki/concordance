import type { CanonicalModel, Entity } from "@concordance-wiki/core";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** One link walked on the way, in the direction it was walked. */
export interface Step {
  from: string;
  to: string;
  relation: string;
  confidence: number;
  /** `out` when the link goes from `from` to `to` in the model, `in` when it was walked against its direction. */
  direction: "out" | "in";
}

export interface Path {
  entities: Entity[];
  steps: Step[];
}

interface Edge {
  other: string;
  step: Step;
}

/** Every link of the model as two directed edges, the best link kept when two join the same pair. */
function edgesOf(model: CanonicalModel): Map<string, Edge[]> {
  const edges = new Map<string, Edge[]>();
  const add = (from: string, edge: Edge): void => {
    const list = edges.get(from) ?? [];
    list.push(edge);
    edges.set(from, list);
  };
  for (const link of model.links) {
    const base = { relation: link.relation, confidence: link.confidence };
    add(link.from, {
      other: link.to,
      step: { ...base, from: link.from, to: link.to, direction: "out" },
    });
    add(link.to, {
      other: link.from,
      step: { ...base, from: link.to, to: link.from, direction: "in" },
    });
  }
  for (const list of edges.values()) {
    list.sort((a, b) => b.step.confidence - a.step.confidence || byCodeUnit(a.other, b.other));
  }
  return edges;
}

interface Reach {
  depth: number;
  /** The sum of the confidences on the way, the higher the better among ways of one length. */
  score: number;
  via?: { from: string; step: Step };
}

/**
 * The shortest way from one entity to another over the links, walked in either direction:
 * fewest links first, then the highest sum of confidences, then the identifiers in code-unit
 * order, so that two runs choose the same way. None when the target is out of the depth.
 */
export function shortestPath(
  model: CanonicalModel,
  from: Entity,
  to: Entity,
  maxDepth: number,
): Path | undefined {
  const byId = new Map(model.entities.map((entity) => [entity.id, entity]));
  const edges = edgesOf(model);
  const start: Reach = { depth: 0, score: 0 };
  const reached = new Map<string, Reach>([[from.id, start]]);
  let frontier: [string, Reach][] = [[from.id, start]];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next = new Map<string, Reach>();
    for (const [id, here] of frontier.sort(([a], [b]) => byCodeUnit(a, b))) {
      for (const { other, step } of edges.get(id) ?? []) {
        if (!byId.has(other)) continue;
        const known = reached.get(other);
        const score = here.score + step.confidence;
        const better =
          known === undefined ||
          (known.depth === depth &&
            (known.score < score ||
              (known.score === score &&
                known.via !== undefined &&
                byCodeUnit(id, known.via.from) < 0)));
        if (!better) continue;
        const reach: Reach = { depth, score, via: { from: id, step } };
        reached.set(other, reach);
        next.set(other, reach);
      }
    }
    frontier = [...next];
    if (reached.has(to.id)) break;
  }
  if (!reached.has(to.id)) return undefined;
  const steps: Step[] = [];
  let cursor = to.id;
  for (let reach = reached.get(cursor); reach?.via !== undefined; reach = reached.get(cursor)) {
    steps.unshift(reach.via.step);
    cursor = reach.via.from;
  }
  const entities = [
    from,
    ...steps
      .map((step) => byId.get(step.to))
      .filter((entity): entity is Entity => entity !== undefined),
  ];
  return { entities, steps };
}

/** An entity reached from another within a radius: how many links away, and the best way's sum of confidences. */
export interface Reached {
  entity: Entity;
  depth: number;
  score: number;
}

/**
 * Every entity within a radius of one, walking the links in either direction, the closest
 * first, then the best sum of confidences, then the identifiers; the entity itself left out.
 */
export function within(model: CanonicalModel, from: Entity, radius: number): Reached[] {
  const byId = new Map(model.entities.map((entity) => [entity.id, entity]));
  const edges = edgesOf(model);
  const reached = new Map<string, Reached>([[from.id, { entity: from, depth: 0, score: 0 }]]);
  let frontier: Reached[] = [{ entity: from, depth: 0, score: 0 }];
  for (let depth = 1; depth <= radius && frontier.length > 0; depth += 1) {
    const next: Reached[] = [];
    for (const here of frontier.sort((a, b) => byCodeUnit(a.entity.id, b.entity.id))) {
      for (const { other, step } of edges.get(here.entity.id) ?? []) {
        const entity = byId.get(other);
        if (entity === undefined) continue;
        const score = here.score + step.confidence;
        const known = reached.get(other);
        if (known === undefined) {
          const reach = { entity, depth, score };
          reached.set(other, reach);
          next.push(reach);
        } else if (known.depth === depth && known.score < score) {
          known.score = score;
        }
      }
    }
    frontier = next;
  }
  return [...reached.values()]
    .filter((reach) => reach.entity.id !== from.id)
    .sort((a, b) => a.depth - b.depth || b.score - a.score || byCodeUnit(a.entity.id, b.entity.id));
}
