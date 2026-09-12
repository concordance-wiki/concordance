import { identifierFor } from "@concordance-wiki/core";

import type { LinkableEntity } from "../explicit/types.js";

/** Lookups built once over every entity: a reference is tried by identifier, by path, then by title. */
export interface EntityIndex {
  byId: ReadonlyMap<string, LinkableEntity>;
  /** Keyed by `<source name>/<path>`. */
  byPath: ReadonlyMap<string, LinkableEntity>;
  /** Keyed by the trimmed title; several notes may share one. */
  byTitle: ReadonlyMap<string, readonly LinkableEntity[]>;
}

export interface ResolveContext {
  from: LinkableEntity;
  index: EntityIndex;
}

export type ReferenceResolution =
  | { kind: "resolved"; entity: LinkableEntity; by: "id" | "path" | "title" }
  | { kind: "ambiguous"; candidates: readonly LinkableEntity[] }
  | { kind: "unresolved" };

export function indexEntities(entities: readonly LinkableEntity[]): EntityIndex {
  const byId = new Map<string, LinkableEntity>();
  const byPath = new Map<string, LinkableEntity>();
  const byTitle = new Map<string, LinkableEntity[]>();
  for (const entity of entities) {
    // The first entity of an identifier wins, as the duplicate resolution of the typing step decided.
    if (!byId.has(entity.id)) byId.set(entity.id, entity);
    const path = `${entity.source.name}/${entity.source.path}`;
    if (!byPath.has(path)) byPath.set(path, entity);
    const title = entity.title.trim();
    const titled = byTitle.get(title) ?? [];
    titled.push(entity);
    byTitle.set(title, titled);
  }
  return { byId, byPath, byTitle };
}

function byIdentifier(value: string, context: ResolveContext): LinkableEntity | undefined {
  return (
    context.index.byId.get(value) ?? context.index.byId.get(`${context.from.source.name}/${value}`)
  );
}

/**
 * A path carries its extension; it is tried as written, then through the identifier it derives, so
 * that `Roles/Account Manager.md` names `roles/account-manager`.
 */
function byPath(value: string, context: ResolveContext): LinkableEntity | undefined {
  if (!value.endsWith(".md")) return undefined;
  const source = context.from.source.name;
  const exact = context.index.byPath.get(`${source}/${value}`);
  if (exact !== undefined) return exact;
  const derived = identifierFor({ source, path: value, typeSuffixes: [] }).id;
  return context.index.byId.get(derived);
}

function byTitle(value: string, context: ResolveContext): ReferenceResolution {
  const candidates = context.index.byTitle.get(value) ?? [];
  const [single] = candidates;
  if (single === undefined) return { kind: "unresolved" };
  return candidates.length === 1
    ? { kind: "resolved", entity: single, by: "title" }
    : { kind: "ambiguous", candidates };
}

/**
 * A reference is an identifier (`specs/roles/account-manager`, or `roles/account-manager` within the
 * source of the note), a path relative to the source root (`roles/account-manager.md`), or the exact
 * title of a note, compared after trimming and case-sensitively. Identifiers and paths are unique; a
 * title shared by several notes resolves nothing.
 */
export function resolveReference(value: string, context: ResolveContext): ReferenceResolution {
  const written = value.trim();
  const identified = byIdentifier(written, context);
  if (identified !== undefined) return { kind: "resolved", entity: identified, by: "id" };
  const located = byPath(written, context);
  if (located !== undefined) return { kind: "resolved", entity: located, by: "path" };
  return byTitle(written, context);
}
