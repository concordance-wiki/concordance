import { pagePath, type Entity } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { Companion, KeywordPageProps, Link, PassageGroup } from "../slots.js";
import { createNoteHref, fileKey, message, type SiteContext } from "./context.js";
import { neighbourhoodOf, neighbourPages } from "./entity-page.js";
import type { FragmentPassage } from "./fragments.js";
import { mentionsPanelOf } from "./mentions.js";
import { entityHref } from "./paths.js";

/** The heaviest companions weigh 5, the lightest 1, by rank of their count. */
const COMPANION_WEIGHTS = 5;
/** How many accompanying words the page shows. */
export const COMPANIONS_MAX = 12;

function numberOf(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/** The position of a source in the build block: the declaration order of the configuration. */
function sourceRank(context: SiteContext, source: string): number {
  const index = context.model.build.sources.findIndex((candidate) => candidate.name === source);
  return index === -1 ? context.model.build.sources.length : index;
}

/**
 * Passages grouped by file in corpus order, sources in declaration order then paths, the
 * passages of a file by line; a file that is no page of the site is left out.
 */
export function passageGroupsOf(
  context: SiteContext,
  page: string,
  passages: readonly FragmentPassage[],
): PassageGroup[] {
  const groups = new Map<string, { source: string; path: string; group: PassageGroup }>();
  for (const passage of passages) {
    const key = fileKey(passage.source, passage.path);
    const note = context.byFile.get(key);
    if (note === undefined) continue;
    let entry = groups.get(key);
    if (entry === undefined) {
      const href = entityHref(page, note.id);
      entry = {
        source: passage.source,
        path: passage.path,
        group: { file: { label: passage.path, href }, passages: [] },
      };
      groups.set(key, entry);
    }
    entry.group.passages.push({
      context: passage.context,
      ...(passage.text === undefined ? {} : { text: passage.text }),
      line: passage.line,
      href: `${entry.group.file.href}#L${String(passage.line)}`,
    });
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        sourceRank(context, a.source) - sourceRank(context, b.source) ||
        byCodeUnit(a.source, b.source) ||
        byCodeUnit(a.path, b.path),
    )
    .map(({ group }) => ({
      file: group.file,
      passages: group.passages.sort((a, b) => a.line - b.line),
    }));
}

/**
 * The weight of every count, from 1 to 5, by the rank of the count among the distinct counts:
 * the largest weighs 5, the smallest 1, equal counts weigh the same; a single count weighs 5.
 */
export function weightsOf(counts: readonly number[]): number[] {
  const distinct = [...new Set(counts)].sort((a, b) => a - b);
  return counts.map((count) =>
    distinct.length === 1
      ? COMPANION_WEIGHTS
      : 1 + Math.round(((COMPANION_WEIGHTS - 1) * distinct.indexOf(count)) / (distinct.length - 1)),
  );
}

/**
 * The accompanying words: the co-occurrence neighbours of the page in the model, the most
 * frequent first, twelve at most, each weighed by the rank of its count. A neighbour the model
 * no longer holds keeps its identifier as label, without a link.
 */
export function companionsOf(context: SiteContext, page: string, entity: Entity): Companion[] {
  const neighbours = (context.model.neighbours?.[entity.id] ?? []).slice(0, COMPANIONS_MAX);
  const weights = weightsOf(neighbours.map((neighbour) => neighbour.count));
  return neighbours.map((neighbour, index) => {
    const target = context.entities.get(neighbour.id);
    return {
      label: target?.title ?? neighbour.id,
      ...(target === undefined ? {} : { href: entityHref(page, neighbour.id) }),
      count: neighbour.count,
      // Built from the same list: one weight per neighbour.
      weight: weights[index] as number,
    };
  });
}

/** The leads of the fragment as links, a lead to a page the model lost being left out. */
export function similarOf(context: SiteContext, page: string, entity: Entity): Link[] {
  return (context.fragments.get(entity.id)?.leads ?? []).flatMap((lead) =>
    context.entities.has(lead.id) ? [{ label: lead.title, href: entityHref(page, lead.id) }] : [],
  );
}

export interface KeywordPageOptions {
  mentionsInline?: number;
}

/**
 * The view model of a keyword page: the counts from the entity, the passages and the leads from
 * its fragment, the companions from the model, the banner from the catalogue with the lead to
 * write the note on the glossary's forge when it is known.
 */
export function keywordPageOf(
  context: SiteContext,
  entity: Entity,
  options: KeywordPageOptions = {},
): KeywordPageProps {
  const page = pagePath(entity.id);
  const neighbourhood = neighbourhoodOf(context, page, entity);
  const passages = context.fragments.get(entity.id)?.passages ?? [];
  const occurrences = numberOf(entity.attributes["occurrences"]);
  const slug = entity.id.replace(/^.*\//, "");
  const createHref = createNoteHref(context, slug);
  return {
    entity: {
      id: entity.id,
      title: entity.title,
      locale: entity.locale,
      typeLabel: message(context, "keyword.title"),
    },
    banner: {
      text: `${message(context, "keyword.undefinedExpression")}. ${formatMessage(context.catalogue, "keyword.passages", { count: occurrences })}.`,
      createNote: {
        label: message(context, "keyword.createNote"),
        ...(createHref === undefined ? {} : { href: createHref }),
      },
    },
    counts: {
      occurrences,
      files: numberOf(entity.attributes["documents"]),
      sources: new Set(passages.map((passage) => passage.source)).size,
    },
    passages: passageGroupsOf(context, page, passages),
    companions: companionsOf(context, page, entity),
    similar: similarOf(context, page, entity),
    similarLead: message(context, "keyword.similarLead"),
    neighbours: neighbourhood,
    mentions: mentionsPanelOf(context, page, entity, options.mentionsInline),
    labels: {
      seeNeighbourhood: message(context, "entity.seeNeighbourhood"),
      neighbourPages: formatMessage(context.catalogue, "entity.neighbourPages", {
        count: neighbourPages(neighbourhood),
      }),
    },
  };
}
