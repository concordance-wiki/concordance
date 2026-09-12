import type { Link } from "@concordance-wiki/core";

import { byCodeUnit } from "../neighbourhood/order.js";
import type {
  DisplayableEntity,
  DisplayedNeighbour,
  DisplayedNeighbourhood,
  DisplayedNeighbourhoodInput,
  NeighbourDirection,
} from "./types.js";

/** The mini-map stays legible at twelve labelled nodes; the configuration schema stops there too. */
export const MAX_DISPLAYED_NEIGHBOURS = 12;

interface Accumulated {
  entity: DisplayableEntity;
  relation: string;
  direction: NeighbourDirection;
  confidence: number;
}

/** Best first: the larger confidence, then the lower identifier. */
function compareDisplayed(a: DisplayedNeighbour, b: DisplayedNeighbour): number {
  return b.confidence - a.confidence || byCodeUnit(a.id, b.id);
}

function merge(
  row: Map<string, Accumulated>,
  entity: DisplayableEntity,
  link: Link,
  direction: NeighbourDirection,
): void {
  const existing = row.get(entity.id);
  if (existing === undefined) {
    row.set(entity.id, { entity, relation: link.relation, direction, confidence: link.confidence });
    return;
  }
  if (
    link.confidence > existing.confidence ||
    (link.confidence === existing.confidence && link.relation < existing.relation)
  ) {
    existing.relation = link.relation;
    existing.confidence = link.confidence;
  }
  if (existing.direction !== direction) {
    existing.direction = "both";
  }
}

function toDisplayed({ entity, relation, direction, confidence }: Accumulated): DisplayedNeighbour {
  return {
    id: entity.id,
    title: entity.title,
    type: entity.type,
    kind: entity.keyword === true ? "keyword" : "entity",
    relation,
    direction,
    confidence,
  };
}

/**
 * The one-hop neighbours of every entity through the links in either direction. A neighbour
 * reached by several links shows the relation of the most confident one; the merge is
 * commutative, so the result depends on the set of links alone. A link whose end is not an
 * entity of the model, or which loops on its node, shows nothing.
 */
export function displayedNeighbourhood(input: DisplayedNeighbourhoodInput): DisplayedNeighbourhood {
  const size = Math.min(input.size, MAX_DISPLAYED_NEIGHBOURS);
  const entities = new Map(input.entities.map((entity) => [entity.id, entity]));
  const rows = new Map<string, Map<string, Accumulated>>();
  const rowOf = (id: string): Map<string, Accumulated> => {
    let row = rows.get(id);
    if (row === undefined) {
      row = new Map();
      rows.set(id, row);
    }
    return row;
  };
  for (const link of input.links) {
    const from = entities.get(link.from);
    const to = entities.get(link.to);
    if (from === undefined || to === undefined || from === to) {
      continue;
    }
    merge(rowOf(from.id), to, link, "out");
    merge(rowOf(to.id), from, link, "in");
  }
  const nodes = new Map<string, DisplayedNeighbour[]>();
  for (const id of [...entities.keys()].sort(byCodeUnit)) {
    const row = rows.get(id);
    const neighbours = row === undefined ? [] : [...row.values()].map(toDisplayed);
    nodes.set(id, neighbours.sort(compareDisplayed).slice(0, size));
  }
  return nodes;
}
