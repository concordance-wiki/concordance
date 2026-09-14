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
  spaceTitle,
  typeLabel,
  type SiteContext,
} from "./context.js";
import { neighbourhoodLabels, neighbourPages } from "./entity-page.js";
import type { FragmentPassage } from "./fragments.js";
import { mentionsOf, mentionsPanelOf, passageLocationOf } from "./mentions.js";
import { entityHref, spaceHref } from "./paths.js";
import { foldersOf, spaceWithPageOf, type Filing } from "./space.js";

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

/** How many passages of a page a keyword page shows in view; the others fold under their count. */
export const PASSAGES_IN_VIEW = 2;

/** How many pages a keyword page shows in view; the other files stand behind a disclosure. */
export const PASSAGE_GROUPS_IN_VIEW = 6;

/** A group of passages with the source it comes from, which orders the groups and names the spaces. */
export interface LocatedGroup {
  source: string;
  /** The first file of the page in path order, which orders the groups of a source. */
  path: string;
  group: PassageGroup;
}

/** Where a passage stands in the corpus: its file, then its line. */
function byFileThenLine(a: FragmentPassage, b: FragmentPassage): number {
  return byCodeUnit(a.path, b.path) || a.line - b.line;
}

/**
 * Passages grouped by page in corpus order, sources in declaration order then paths, the
 * passages of a page by file then line, each group carrying the title and the type of its page
 * and each passage where it stands; the notes and the documents of one page (the notes and the
 * transcript of a meeting) make one group, and a file that is no page of the site is left out.
 */
export function locatedGroupsOf(
  context: SiteContext,
  page: string,
  passages: readonly FragmentPassage[],
): LocatedGroup[] {
  const groups = new Map<string, LocatedGroup & { note: Entity; found: FragmentPassage[] }>();
  for (const passage of passages) {
    const note = context.byFile.get(fileKey(passage.source, passage.path));
    if (note === undefined) continue;
    let entry = groups.get(note.id);
    if (entry === undefined) {
      entry = {
        source: passage.source,
        path: passage.path,
        note,
        found: [],
        group: {
          file: { label: note.source.path, href: entityHref(page, note.id) },
          title: note.title,
          typeLabel: typeLabel(context, note.type),
          passages: [],
        },
      };
      groups.set(note.id, entry);
    }
    entry.found.push(passage);
    if (byCodeUnit(passage.path, entry.path) < 0) entry.path = passage.path;
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        sourceRank(context, a.source) - sourceRank(context, b.source) ||
        byCodeUnit(a.source, b.source) ||
        byCodeUnit(a.path, b.path),
    )
    .map(({ note, found, ...entry }) => {
      const passages = found.toSorted(byFileThenLine).map((passage) => ({
        context: passage.context,
        ...(passage.text === undefined ? {} : { text: passage.text }),
        line: passage.line,
        href: `${entry.group.file.href}#L${String(passage.line)}`,
        location: passageLocationOf(context, note, passage),
      }));
      return { ...entry, group: { ...entry.group, passages } };
    });
}

/** A group with its first passages in view and the others folded under their count, when it holds more than the view. */
export function foldedGroupOf(context: SiteContext, group: PassageGroup): PassageGroup {
  if (group.passages.length <= PASSAGES_IN_VIEW) return group;
  const folded = group.passages.slice(PASSAGES_IN_VIEW);
  return {
    ...group,
    passages: group.passages.slice(0, PASSAGES_IN_VIEW),
    folded: {
      label: formatMessage(context.catalogue, "keyword.otherPassages", { count: folded.length }),
      passages: folded,
    },
  };
}

/** The passages grouped by page in corpus order, as the page lists them, every group folded past its first passages. */
export function passageGroupsOf(
  context: SiteContext,
  page: string,
  passages: readonly FragmentPassage[],
): PassageGroup[] {
  return locatedGroupsOf(context, page, passages).map((entry) =>
    foldedGroupOf(context, entry.group),
  );
}

/**
 * The passages block of the page: the first pages in view, each folded past its first passages,
 * and the other files behind a disclosure worded with their count when there are more.
 */
export function passageBlocksOf(
  context: SiteContext,
  groups: readonly LocatedGroup[],
): Pick<KeywordPageProps, "passages" | "morePassages"> {
  const folded = groups.map((entry) => foldedGroupOf(context, entry.group));
  const beyond = folded.slice(PASSAGE_GROUPS_IN_VIEW);
  return {
    passages: folded.slice(0, PASSAGE_GROUPS_IN_VIEW),
    ...(beyond.length === 0
      ? {}
      : {
          morePassages: {
            label: formatMessage(context.catalogue, "keyword.showOtherFiles", {
              count: beyond.length,
            }),
            groups: beyond,
          },
        }),
  };
}

/** Where a word is filed: its space and, in it, the folder and the passage count of its node in the tree. */
export interface KeywordFiling extends Filing {
  source: string;
}

/**
 * The space a word is filed in: the first glossary source the model knows, where its note would
 * be written, else the source of its first passage; none for a word without either. In that
 * space the word stands in the folder of its first passage there, at the root when the space
 * holds none, with every passage of the word counted after its name.
 */
export function keywordSpaceOf(
  context: SiteContext,
  groups: readonly LocatedGroup[],
): KeywordFiling | undefined {
  const known = new Set(context.model.build.sources.map((source) => source.name));
  const source = context.glossarySources?.find((name) => known.has(name)) ?? groups[0]?.source;
  if (source === undefined) return undefined;
  const first = groups.find((group) => group.source === source);
  return {
    source,
    folders: first === undefined ? [] : foldersOf(first.path),
    passages: groups.reduce((total, group) => total + group.group.passages.length, 0),
  };
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

/** How many passages use a page the leads name: the occurrences of a keyword page, the passages that mention a note. */
function passagesUsing(context: SiteContext, page: string, target: Entity): number {
  return target.keyword === true
    ? numberOf(target.attributes["occurrences"])
    : mentionsOf(context, page, target).length;
}

/**
 * The leads of the fragment as links, one per page in the order of the leads: a note reached
 * under several of its forms is named once, by its title, the other forms as its aliases; each
 * lead carries how many passages use the page; a lead to a page the model lost is left out.
 */
export function similarOf(context: SiteContext, page: string, entity: Entity): SimilarExpression[] {
  const leads = new Map<string, SimilarExpression>();
  for (const lead of context.fragments.get(entity.id)?.leads ?? []) {
    const target = context.entities.get(lead.id);
    if (target === undefined) continue;
    const known = leads.get(lead.id) ?? {
      label: target.title,
      href: entityHref(page, lead.id),
      count: passagesUsing(context, page, target),
    };
    if (lead.title !== target.title && !known.aliases?.includes(lead.title)) {
      known.aliases = [...(known.aliases ?? []), lead.title];
    }
    leads.set(lead.id, known);
  }
  return [...leads.values()];
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
  const filing = keywordSpaceOf(context, groups);
  const usedSince = usedSinceOf(context, passages);
  const mentions = mentionsPanelOf(context, page, entity, options.mentionsInline);
  return {
    entity: {
      id: entity.id,
      title: entity.title,
      locale: entity.locale,
      typeLabel: message(context, "keyword.title"),
    },
    ...(filing === undefined
      ? {}
      : {
          space: spaceWithPageOf(context, page, entity, filing.source, filing),
          breadcrumb: [
            { label: spaceTitle(context, filing.source), href: spaceHref(page, filing.source) },
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
    spaces: [...new Set(groups.map((group) => group.source))].map((source) =>
      spaceTitle(context, source),
    ),
    summary: formatMessage(context.catalogue, "keyword.filesSummary", { count: files }),
    ...passageBlocksOf(context, groups),
    similar: similarOf(context, page, entity),
    similarLead: message(context, "keyword.similarLead"),
    neighbours: neighbourhood,
    mentions,
    labels: keywordPageLabels(context, neighbourPages(neighbourhood)),
  };
}
