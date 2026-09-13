import { pagePath, type Entity } from "@concordance-wiki/core";
import { formatMessage, formatMonth } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  ChangeDate,
  KeywordPageLabels,
  KeywordPageProps,
  Neighbour,
  NeighbourhoodProps,
  PassageGroup,
  SimilarExpression,
} from "../slots.js";
import {
  createNoteHref,
  fileKey,
  glyphNameOf,
  message,
  typeLabel,
  type SiteContext,
} from "./context.js";
import { neighbourhoodLabels, neighbourPages } from "./entity-page.js";
import type { FragmentPassage } from "./fragments.js";
import { mentionsPanelOf, passageLocationOf } from "./mentions.js";
import { entityHref, spaceHref } from "./paths.js";
import { spaceWithPageOf } from "./space.js";

/** How many nodes the map of a keyword page draws: the words that accompany it most often. */
export const KEYWORD_NEIGHBOURS_MAX = 6;

function numberOf(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/** The position of a source in the build block: the declaration order of the configuration. */
function sourceRank(context: SiteContext, source: string): number {
  const index = context.model.build.sources.findIndex((candidate) => candidate.name === source);
  return index === -1 ? context.model.build.sources.length : index;
}

export { passageLocationOf } from "./mentions.js";

/** A group of passages with the source it comes from, which orders the groups and names the spaces. */
export interface LocatedGroup {
  source: string;
  path: string;
  group: PassageGroup;
}

/**
 * Passages grouped by file in corpus order, sources in declaration order then paths, the
 * passages of a file by line, each group carrying the title and the type of its page and each
 * passage where it stands; a file that is no page of the site is left out.
 */
export function locatedGroupsOf(
  context: SiteContext,
  page: string,
  passages: readonly FragmentPassage[],
): LocatedGroup[] {
  const groups = new Map<string, LocatedGroup>();
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
        group: {
          file: { label: passage.path, href },
          title: note.title,
          typeLabel: typeLabel(context, note.type),
          passages: [],
        },
      };
      groups.set(key, entry);
    }
    entry.group.passages.push({
      context: passage.context,
      ...(passage.text === undefined ? {} : { text: passage.text }),
      line: passage.line,
      href: `${entry.group.file.href}#L${String(passage.line)}`,
      location: passageLocationOf(context, note, passage),
    });
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        sourceRank(context, a.source) - sourceRank(context, b.source) ||
        byCodeUnit(a.source, b.source) ||
        byCodeUnit(a.path, b.path),
    )
    .map((entry) => ({
      ...entry,
      group: { ...entry.group, passages: entry.group.passages.toSorted((a, b) => a.line - b.line) },
    }));
}

/** The passages grouped by file in corpus order, as the page lists them. */
export function passageGroupsOf(
  context: SiteContext,
  page: string,
  passages: readonly FragmentPassage[],
): PassageGroup[] {
  return locatedGroupsOf(context, page, passages).map((entry) => entry.group);
}

/**
 * The space a word is filed in: the first glossary source the model knows, where its note would
 * be written, else the source of its first passage; none for a word without either.
 */
export function keywordSpaceOf(
  context: SiteContext,
  groups: readonly LocatedGroup[],
): string | undefined {
  const known = new Set(context.model.build.sources.map((source) => source.name));
  return context.glossarySources?.find((name) => known.has(name)) ?? groups[0]?.source;
}

/**
 * Since when the word is used: the oldest git date among the files of its passages, worded by
 * month; none when no file carries a date.
 */
export function usedSinceOf(
  context: SiteContext,
  passages: readonly FragmentPassage[],
): ChangeDate | undefined {
  let earliest: string | undefined;
  for (const passage of passages) {
    const date = context.byFile.get(fileKey(passage.source, passage.path))?.source.last_modified;
    if (date !== undefined && (earliest === undefined || Date.parse(date) < Date.parse(earliest))) {
      earliest = date;
    }
  }
  if (earliest === undefined) return undefined;
  return {
    date: earliest.slice(0, 10),
    label: formatMessage(context.catalogue, "keyword.usedSince", {
      month: formatMonth(context.locale ?? context.language, new Date(earliest)),
    }),
  };
}

/**
 * The neighbourhood of a word nobody defined: a keyword page carries no link, so its map is
 * drawn from its co-occurrences, the `neighbours` block of the model, the most frequent first
 * and six at most, the entities the model holds as full nodes and the other noteless words as
 * dashed ones, each weighed by the number of paragraphs it shares with the word; a neighbour
 * the model no longer holds is left out, and `total` counts every one it still holds.
 */
export function keywordNeighbourhoodOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): NeighbourhoodProps {
  const known = (context.model.neighbours?.[entity.id] ?? []).flatMap((neighbour) => {
    const target = context.entities.get(neighbour.id);
    return target === undefined ? [] : [{ target, count: neighbour.count }];
  });
  const neighbours: Neighbour[] = known
    .slice(0, KEYWORD_NEIGHBOURS_MAX)
    .map(({ target, count }) => {
      const keyword = target.keyword === true;
      const glyph = keyword ? undefined : glyphNameOf(context, target.type);
      return {
        id: target.id,
        label: target.title,
        href: entityHref(page, target.id),
        typeLabel: keyword ? message(context, "keyword.title") : typeLabel(context, target.type),
        weight: count,
        kind: keyword ? "keyword" : "entity",
        ...(glyph === undefined ? {} : { typeGlyph: glyph }),
      };
    });
  return {
    centre: entity.title,
    neighbours,
    total: known.length,
    labels: neighbourhoodLabels(context, neighbours.length, known.length),
  };
}

/**
 * The leads of the fragment as links, a keyword page among them carrying its occurrence count;
 * a lead to a page the model lost is left out.
 */
export function similarOf(context: SiteContext, page: string, entity: Entity): SimilarExpression[] {
  return (context.fragments.get(entity.id)?.leads ?? []).flatMap((lead) => {
    const target = context.entities.get(lead.id);
    if (target === undefined) return [];
    return [
      {
        label: lead.title,
        href: entityHref(page, lead.id),
        ...(target.keyword === true ? { count: numberOf(target.attributes["occurrences"]) } : {}),
      },
    ];
  });
}

/** The headings and notes of the page in the site language. */
export function keywordPageLabels(context: SiteContext, neighbours: number): KeywordPageLabels {
  return {
    spaceTree: message(context, "entity.spaceTree"),
    breadcrumb: message(context, "entity.breadcrumb"),
    noDefinition: message(context, "keyword.noDefinition"),
    passages: message(context, "keyword.passagesTitle"),
    whatWeKnow: message(context, "keyword.whatWeKnow"),
    occurrences: message(context, "keyword.factOccurrences"),
    files: message(context, "keyword.factFiles"),
    spaces: message(context, "keyword.factSpaces"),
    noProperty: message(context, "keyword.noProperty"),
    maybeSame: message(context, "keyword.maybeSame"),
    seeNeighbourhood: message(context, "entity.seeNeighbourhood"),
    neighbourPages: formatMessage(context.catalogue, "entity.neighbourPages", {
      count: neighbours,
    }),
  };
}

export interface KeywordPageOptions {
  mentionsInline?: number;
}

/**
 * The view model of a keyword page: the space the word is filed in and its breadcrumb, since
 * when it is used, the notice from the catalogue with the lead to propose a definition on the
 * glossary's forge when it is known, the counts from the entity, the passages and the leads
 * from its fragment, the neighbourhood from its co-occurrences, the related pages — the pages
 * where the word is used — with the note that none is cited, and the labels of the page in the
 * site language.
 */
export function keywordPageOf(
  context: SiteContext,
  entity: Entity,
  options: KeywordPageOptions = {},
): KeywordPageProps {
  const page = pagePath(entity.id);
  const neighbourhood = keywordNeighbourhoodOf(context, page, entity);
  const passages = context.fragments.get(entity.id)?.passages ?? [];
  const groups = locatedGroupsOf(context, page, passages);
  const occurrences = numberOf(entity.attributes["occurrences"]);
  const files = numberOf(entity.attributes["documents"]);
  const slug = entity.id.replace(/^.*\//, "");
  // The new-file page of the glossary on its forge, else the contribution address of the project; none without either, and the page shows no lead.
  const createHref = createNoteHref(context, slug) ?? context.contributeUrl;
  const space = keywordSpaceOf(context, groups);
  const usedSince = usedSinceOf(context, passages);
  const mentions = mentionsPanelOf(context, page, entity, options.mentionsInline);
  return {
    entity: {
      id: entity.id,
      title: entity.title,
      locale: entity.locale,
      typeLabel: message(context, "keyword.title"),
    },
    ...(space === undefined
      ? {}
      : {
          space: spaceWithPageOf(context, page, entity, space),
          breadcrumb: [
            { label: space, href: spaceHref(page, space) },
            { label: message(context, "keyword.terms") },
            { label: entity.title },
          ],
        }),
    ...(usedSince === undefined ? {} : { usedSince }),
    banner: {
      text: formatMessage(context.catalogue, "keyword.noticeLead", { count: occurrences }),
      detail: message(context, "keyword.noticeDetail"),
      createNote: {
        label: message(context, "keyword.createNote"),
        ...(createHref === undefined ? {} : { href: createHref }),
      },
    },
    counts: {
      occurrences,
      files,
      sources: new Set(passages.map((passage) => passage.source)).size,
    },
    spaces: [...new Set(groups.map((group) => group.source))],
    summary: formatMessage(context.catalogue, "keyword.filesSummary", { count: files }),
    passages: groups.map((group) => group.group),
    similar: similarOf(context, page, entity),
    similarLead: message(context, "keyword.similarLead"),
    neighbours: neighbourhood,
    mentions,
    labels: keywordPageLabels(context, neighbourPages(neighbourhood)),
  };
}
