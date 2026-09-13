import type { Entity } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import type { TodoEntry, TodoProps } from "../slots.js";
import type { SiteContext } from "./context.js";
import { entityHref, TODO_PAGE } from "./paths.js";

/** The check that reports a document without a markdown representation. */
export const DOCUMENT_WITHOUT_MARKDOWN = "W-DOC-NOMD";

function occurrencesOf(entity: Entity): number {
  const occurrences = entity.attributes["occurrences"];
  return typeof occurrences === "number" ? occurrences : 0;
}

/** The keyword pages, most cited first, then by identifier. */
export function termsOf(context: SiteContext): TodoEntry[] {
  return context.model.entities
    .filter((entity) => entity.keyword === true)
    .sort((a, b) => occurrencesOf(b) - occurrencesOf(a) || byCodeUnit(a.id, b.id))
    .map((entity) => ({
      label: entity.title,
      href: entityHref(TODO_PAGE, entity.id),
      count: occurrencesOf(entity),
    }));
}

/** The entities the `W-DOC-NOMD` findings name, one entry per entity with its finding count. */
export function documentsOf(context: SiteContext): TodoEntry[] {
  const counted = new Map<string, { entity: Entity; count: number }>();
  for (const finding of context.model.findings) {
    if (finding.check !== DOCUMENT_WITHOUT_MARKDOWN || finding.entity === undefined) continue;
    const entity = context.entities.get(finding.entity);
    if (entity === undefined) continue;
    const entry = counted.get(entity.id) ?? { entity, count: 0 };
    entry.count += 1;
    counted.set(entity.id, entry);
  }
  return [...counted.values()]
    .sort((a, b) => b.count - a.count || byCodeUnit(a.entity.id, b.entity.id))
    .map(({ entity, count }) => ({
      label: entity.title,
      href: entityHref(TODO_PAGE, entity.id),
      count,
    }));
}

export function todoOf(context: SiteContext): TodoProps {
  return { documents: documentsOf(context), terms: termsOf(context) };
}
