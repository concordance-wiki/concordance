import type { CanonicalModel, Entity, Link, Provenance } from "@concordance-wiki/core";

/** A note of the model, its source and path derived from its identifier unless given. */
export function entity(id: string, overrides: Partial<Entity> = {}): Entity {
  const [source = "notes", ...rest] = id.split("/");
  return {
    id,
    type: "term",
    title: rest.join(" "),
    aliases: [],
    locale: "en",
    status: "valid",
    type_origin: "source",
    graph: "full",
    attributes: {},
    source: { name: source, path: `${rest.join("/")}.md`, line: 1 },
    ...overrides,
  };
}

export function link(
  from: string,
  to: string,
  provenance: Provenance[],
  overrides: Partial<Link> = {},
): Link {
  return { from, to, relation: "related", confidence: 0.5, provenance, ...overrides };
}

/** A model of the given entities and links, built at a fixed instant from two sources. */
export function model(entities: Entity[], links: Link[] = []): CanonicalModel {
  return {
    version: 1,
    build: {
      tool: "0.0.0",
      at: "2026-09-12T12:00:00.000Z",
      profile_hash: "0000",
      sources: [{ name: "notes", commit: "0123456789abcdef" }, { name: "specs" }],
    },
    entities,
    links,
    findings: [],
    candidates: { terms: [], duplicates: [] },
  };
}
