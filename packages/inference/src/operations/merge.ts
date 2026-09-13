import type { Entity, EntityRepresentation, Link } from "@concordance-wiki/core";

import type { ImportedOperation, MatchRung } from "./match.js";

/** The `kind` of the representation an imported operation becomes. */
export const CONTRACT_REPRESENTATION = "contract";

function representationFormat(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "file";
  const extension = name.slice(dot + 1).toLowerCase();
  return extension === "md" ? "markdown" : extension;
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function sortedAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(attributes).sort(byCodeUnit)) sorted[key] = attributes[key];
  return sorted;
}

/**
 * The note absorbs the operation: it keeps its identifier, its file, its title and its frontmatter,
 * takes the contract attributes it does not set itself, the operation's aliases and its summary
 * when it has none, and lists the contract as a representation next to its own file, the way twin
 * resources are listed; `grouped_by` names the rung, after any criterion the note already carried.
 */
export function mergeOperation(
  note: Entity,
  operation: ImportedOperation,
  rung: MatchRung,
): Entity {
  const imported = operation.entity;
  const summary = note.summary ?? imported.summary;
  const aliases = [
    ...note.aliases,
    ...imported.aliases.filter((alias) => !note.aliases.includes(alias)),
  ];
  const own: EntityRepresentation[] = note.representations ?? [
    { path: note.source.path, format: representationFormat(note.source.path) },
  ];
  const contract: EntityRepresentation = {
    path: operation.location,
    format: representationFormat(operation.location),
    kind: CONTRACT_REPRESENTATION,
    operation: operation.name,
  };
  return {
    ...note,
    aliases,
    ...(summary === undefined ? {} : { summary }),
    attributes: sortedAttributes({ ...imported.attributes, ...note.attributes }),
    representations: [...own, contract],
    grouped_by: note.grouped_by === undefined ? rung : `${note.grouped_by}, ${rung}`,
  };
}

/** Every link that named the imported operation now names the note, the `exposes` link of the API first of all. */
export function redirectLinks(
  links: readonly Link[],
  redirections: ReadonlyMap<string, string>,
): Link[] {
  return links.map((link) => {
    const from = redirections.get(link.from) ?? link.from;
    const to = redirections.get(link.to) ?? link.to;
    return from === link.from && to === link.to ? link : { ...link, from, to };
  });
}
