import { pagePath, type Entity } from "@concordance-wiki/core";

import type { Companion, KeywordPageProps, PassageGroup } from "../slots.js";
import { fileKey, type SiteContext } from "./context.js";
import type { FragmentPassage } from "./fragments.js";
import { entityHref } from "./paths.js";

/** The heaviest companion weighs 5, the others in proportion, never under 1. */
const COMPANION_WEIGHTS = 5;

function numberOf(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/** Passages grouped by file in corpus order; a file that is no page of the site is left out. */
export function passageGroupsOf(
  context: SiteContext,
  page: string,
  passages: readonly FragmentPassage[],
): PassageGroup[] {
  const groups: PassageGroup[] = [];
  let last: { key: string; group: PassageGroup } | undefined;
  for (const passage of passages) {
    const key = fileKey(passage.source, passage.path);
    const note = context.byFile.get(key);
    if (note === undefined) continue;
    if (last?.key !== key) {
      const href = entityHref(page, note.id);
      last = { key, group: { file: { label: passage.path, href }, passages: [] } };
      groups.push(last.group);
    }
    last.group.passages.push({
      context: passage.context,
      line: passage.line,
      href: `${last.group.file.href}#L${String(passage.line)}`,
    });
  }
  return groups;
}

/** The co-occurrence neighbours of the model, weighed against the most frequent one. */
export function companionsOf(context: SiteContext, page: string, entity: Entity): Companion[] {
  const neighbours = context.model.neighbours?.[entity.id] ?? [];
  const max = neighbours.reduce((best, neighbour) => Math.max(best, neighbour.count), 0);
  return neighbours.map((neighbour) => {
    const target = context.entities.get(neighbour.id);
    return {
      label: target?.title ?? neighbour.id,
      ...(target === undefined ? {} : { href: entityHref(page, neighbour.id) }),
      weight: Math.max(1, Math.round((COMPANION_WEIGHTS * neighbour.count) / max)),
    };
  });
}

/** The view model of a keyword page: counts from the entity, passages from its fragment, companions from the model. */
export function keywordPageOf(context: SiteContext, entity: Entity): KeywordPageProps {
  const page = pagePath(entity.id);
  const passages = context.fragments.get(entity.id)?.passages ?? [];
  return {
    entity: { id: entity.id, title: entity.title, locale: entity.locale },
    counts: {
      occurrences: numberOf(entity.attributes["occurrences"]),
      files: numberOf(entity.attributes["documents"]),
      sources: new Set(passages.map((passage) => passage.source)).size,
    },
    passages: passageGroupsOf(context, page, passages),
    companions: companionsOf(context, page, entity),
    // Expressions with a similar form need a similarity the model does not carry yet.
    similar: [],
  };
}
