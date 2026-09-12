import type { Locale } from "../config/types.js";

/** Mirrors the `type_origin` pattern of the entities in `schemas/model.schema.json`. */
export type TypeOrigin =
  "source" | `rule#${number}` | "suffix" | "frontmatter" | "contract" | "default";

/** How the entity enters the graph: `documents-only` types are only ever the source of a `documents` relation. */
export type EntityGraph = "full" | "documents-only";

export interface EntitySource {
  name: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  line: number;
  commit?: string;
  /** ISO 8601 date of the last change; absent for a keyword page, which has no file of its own. */
  last_modified?: string;
}

/** One file of an entity that several resources represent: a note, its deck, its transcript. */
export interface EntityRepresentation {
  /** Forward-slash path relative to the source root. */
  path: string;
  /** `markdown` for a note, otherwise the lowercase extension. */
  format: string;
  preview?: string;
}

/** One node of the model, as serialised under `entities` in `model.json`. */
export interface Entity {
  id: string;
  type: string;
  title: string;
  aliases: string[];
  locale: Locale;
  application?: string;
  domain?: string;
  status: string;
  summary?: string;
  type_origin: TypeOrigin;
  graph: EntityGraph;
  /** Frontmatter keys that are not common attributes, over the defaults set by the typing rules. */
  attributes: Record<string, unknown>;
  source: EntitySource;
  /** `true` for a keyword page without a note, located on the first mention of its expression. */
  keyword?: boolean;
  /** Present when several resources were merged into this entity. */
  representations?: EntityRepresentation[];
  /** What merged the representations, for the page to name it. */
  grouped_by?: string;
}

/** Canonical order of entities: by identifier, code unit by code unit. */
export function compareEntities(a: Entity, b: Entity): number {
  if (a.id < b.id) return -1;
  return a.id > b.id ? 1 : 0;
}
