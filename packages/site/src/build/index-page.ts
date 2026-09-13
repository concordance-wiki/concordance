import type { Entity } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import { NOTELESS_FACET } from "../search/shared.js";
import type {
  IndexEntry,
  IndexFilters,
  IndexFilterValue,
  IndexLabels,
  IndexLetter,
  IndexProps,
} from "../slots.js";
import { fileKey, glyphOf, message, typeLabel, type SiteContext } from "./context.js";
import type { FragmentPassage } from "./fragments.js";
import { entityHref, INDEX_PAGE, relativeHref, SEARCH_PAGE } from "./paths.js";

/** The letters of the navigation; titles opening otherwise gather under the last one. */
export const INDEX_LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(/(?=.)/u), "#"];

/** Past this weight of the whole index, rendered as one page, every letter gets a page of its own. */
export const INDEX_SEGMENT_BYTES = 100_000;

/** Characters of a summary a row shows; a first paragraph standing in for a summary is cut there, at a word. */
export const INDEX_SUMMARY_MAX_CHARS = 200;

/** A text cut at the last word boundary before the limit, an ellipsis marking the cut; whole when it fits. */
export function excerptOf(text: string, maxChars: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxChars) return text;
  const head = characters.slice(0, maxChars).join("");
  const boundary = head.search(/\s+\S*$/);
  return `${(boundary > 0 ? head.slice(0, boundary) : head).trimEnd()}…`;
}

/** Case and accents folded, to pick the letter a title files under whatever the collation. */
export function foldTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function letterOf(title: string): string {
  const first = foldTitle(title).trimStart().slice(0, 1).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

/** The path segment and anchor of a letter: lowercase, `other` for the bucket of digits and symbols. */
export function letterSlug(letter: string): string {
  return letter === "#" ? "other" : letter.toLowerCase();
}

/** The page of a letter when the index is segmented. */
export function letterPagePath(letter: string): string {
  return `index/${letterSlug(letter)}/index.html`;
}

/** Where a letter is reached from a page: its own page when the index is segmented, its anchor in the whole index otherwise. */
export function letterHref(from: string, letter: string, segmented: boolean): string {
  return segmented
    ? relativeHref(from, letterPagePath(letter))
    : `${relativeHref(from, INDEX_PAGE)}#${letterSlug(letter)}`;
}

export interface IndexPage {
  path: string;
  props: IndexProps;
  /** The letter the page shows; absent when it shows the whole index. */
  letter?: string;
}

export interface IndexPlan {
  segmented: boolean;
  /** The pages to write, `index/index.html` first. */
  pages: IndexPage[];
  /** How many entries each letter has, in the order of the letter bar. */
  counts: { letter: string; count: number }[];
}

interface Filed {
  entity: Entity;
  letter: string;
}

/** Every page of the site in the order of the project locale's collation, the identifier breaking ties. */
export function filedEntities(context: SiteContext): Filed[] {
  return [...context.model.entities]
    .sort((a, b) => context.collate(a.title, b.title) || byCodeUnit(a.id, b.id))
    .map((entity) => ({ entity, letter: letterOf(entity.title) }));
}

function numberOf(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/** How many pages cite an entry: the distinct pages linking to a note, the files an expression is read in. */
export function citingPages(context: SiteContext, entity: Entity): number {
  if (entity.keyword === true) return numberOf(entity.attributes["documents"]);
  return new Set((context.incoming.get(entity.id) ?? []).map((link) => link.from)).size;
}

interface CitingFile {
  note: Entity;
  first: FragmentPassage;
  passages: number;
}

/**
 * The passage of a word without a definition that stands for its description: the first
 * passage, by line, of the file that uses the word most, the first such file in fragment order
 * when several tie, quoted and followed by the title of that file; none when no page of the
 * site uses the word.
 */
export function mostCitedPassageOf(context: SiteContext, entity: Entity): string | undefined {
  const files = new Map<string, CitingFile>();
  for (const passage of context.fragments.get(entity.id)?.passages ?? []) {
    const key = fileKey(passage.source, passage.path);
    const note = context.byFile.get(key);
    if (note === undefined) continue;
    const file = files.get(key);
    if (file === undefined) {
      files.set(key, { note, first: passage, passages: 1 });
    } else {
      file.passages += 1;
      if (passage.line < file.first.line) file.first = passage;
    }
  }
  let best: CitingFile | undefined;
  for (const file of files.values()) {
    if (best === undefined || file.passages > best.passages) best = file;
  }
  if (best === undefined) return undefined;
  return formatMessage(context.catalogue, "index.passage", {
    passage: best.first.context,
    title: best.note.title,
  });
}

/** The first line of a page: its summary cut at a word; the most cited passage of a word without a definition. */
export function summaryOf(context: SiteContext, entity: Entity): string | undefined {
  if (entity.keyword === true) return mostCitedPassageOf(context, entity);
  return entity.summary === undefined
    ? undefined
    : excerptOf(entity.summary, INDEX_SUMMARY_MAX_CHARS);
}

function entryOf(context: SiteContext, from: string, filed: Filed, anchor?: string): IndexEntry {
  const { entity, letter } = filed;
  const noteless = entity.keyword === true;
  const glyph = noteless ? undefined : glyphOf(context, entity.type);
  const summary = summaryOf(context, entity);
  return {
    label: entity.title,
    href: entityHref(from, entity.id),
    letter,
    ...(glyph === undefined ? {} : { glyph }),
    ...(noteless ? {} : { typeLabel: typeLabel(context, entity.type) }),
    ...(summary === undefined ? {} : { summary }),
    ...(anchor === undefined ? {} : { anchor }),
    count: citingPages(context, entity),
  };
}

/** The results page filtered by one facet value, from a page of the index. */
function filterHref(from: string, facet: string, value: string): string {
  return `${relativeHref(from, SEARCH_PAGE)}?${facet}=${encodeURIComponent(value)}`;
}

function valuesOf(
  from: string,
  facet: string,
  counts: ReadonlyMap<string, number>,
  labelOf: (value: string) => string,
): IndexFilterValue[] {
  return [...counts]
    .map(([value, count]) => ({
      label: labelOf(value),
      href: filterHref(from, facet, value),
      count,
    }))
    .sort((a, b) => byCodeUnit(a.label, b.label) || byCodeUnit(a.href, b.href));
}

function tally(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * The filters of the index seen from a page: the types of the notes with their labels, the
 * spaces, and the words without a definition, every value leading to the results page filtered
 * by it, which lists the whole site under its facets when it receives no query.
 */
export function filtersOf(context: SiteContext, from: string, filed: Filed[]): IndexFilters {
  const types = new Map<string, number>();
  const spaces = new Map<string, number>();
  let noteless = 0;
  for (const { entity } of filed) {
    tally(spaces, entity.source.name);
    if (entity.keyword === true) {
      noteless += 1;
    } else {
      tally(types, entity.type);
    }
  }
  return {
    types: valuesOf(from, "type", types, (type) => typeLabel(context, type)),
    spaces: valuesOf(from, "source", spaces, (space) => space),
    withoutDefinition: {
      label: message(context, "index.withoutDefinition"),
      href: filterHref(from, NOTELESS_FACET, "only"),
      count: noteless,
    },
  };
}

/** The strings of the index in the site language, the sentence under the title and the empty letters counted. */
export function indexLabels(context: SiteContext, filed: Filed[], empty: number): IndexLabels {
  return {
    title: message(context, "index.title"),
    lead: formatMessage(context.catalogue, "index.lead", {
      words: filed.length,
      notes: filed.filter(({ entity }) => entity.keyword !== true).length,
    }),
    filters: message(context, "index.filters"),
    byType: message(context, "index.byType"),
    bySpace: message(context, "index.bySpace"),
    letters: message(context, "index.letters"),
    lettersWithout: formatMessage(context.catalogue, "index.lettersWithout", { count: empty }),
    word: message(context, "index.columnWord"),
    type: message(context, "index.columnType"),
    description: message(context, "index.columnDescription"),
    pages: message(context, "index.columnPages"),
    noDefinition: message(context, "index.noDefinition"),
    note: message(context, "index.note"),
  };
}

/** What every page of the index carries besides its entries: the counts, the filters and the labels. */
function frameOf(
  context: SiteContext,
  from: string,
  filed: Filed[],
): Omit<IndexProps, "letters" | "entries"> {
  const counts = countsOf(filed);
  const empty = INDEX_LETTERS.filter((letter) => (counts.get(letter) ?? 0) === 0).length;
  return {
    counts: {
      words: filed.length,
      notes: filed.filter(({ entity }) => entity.keyword !== true).length,
    },
    filters: filtersOf(context, from, filed),
    labels: indexLabels(context, filed, empty),
  };
}

function countsOf(filed: Filed[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { letter } of filed) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

/** The letter bar seen from a page: a letter with entries links to its place and words its count, the others stay inactive. */
function lettersOf(
  context: SiteContext,
  from: string,
  counts: Map<string, number>,
  segmented: boolean,
): IndexLetter[] {
  return INDEX_LETTERS.map((letter) => {
    const count = counts.get(letter) ?? 0;
    return count === 0
      ? { letter, count }
      : {
          letter,
          href: letterHref(from, letter, segmented),
          count,
          countLabel: formatMessage(context.catalogue, "index.words", { count }),
        };
  });
}

/** The whole index in one page, the first entry of every letter anchored for the bar. */
export function indexOf(context: SiteContext, filed = filedEntities(context)): IndexProps {
  const counts = countsOf(filed);
  const seen = new Set<string>();
  const entries = filed.map((item) => {
    const first = !seen.has(item.letter);
    seen.add(item.letter);
    return entryOf(context, INDEX_PAGE, item, first ? letterSlug(item.letter) : undefined);
  });
  return {
    letters: lettersOf(context, INDEX_PAGE, counts, false),
    entries,
    ...frameOf(context, INDEX_PAGE, filed),
  };
}

function letterPageOf(
  context: SiteContext,
  filed: Filed[],
  letter: string,
  path: string,
): IndexPage {
  return {
    path,
    letter,
    props: {
      letters: lettersOf(context, path, countsOf(filed), true),
      current: letter,
      entries: filed
        .filter((item) => item.letter === letter)
        .map((item) => entryOf(context, path, item)),
      ...frameOf(context, path, filed),
    },
  };
}

/**
 * One page for the whole index when `weigh` finds it under `INDEX_SEGMENT_BYTES`; otherwise one
 * page per letter with entries, `index/index.html` repeating the first of them so that the address
 * of the index keeps answering.
 */
export function planIndex(context: SiteContext, weigh: (props: IndexProps) => number): IndexPlan {
  const filed = filedEntities(context);
  const counts = countsOf(filed);
  const summary = INDEX_LETTERS.map((letter) => ({ letter, count: counts.get(letter) ?? 0 }));
  const whole = indexOf(context, filed);
  if (weigh(whole) <= INDEX_SEGMENT_BYTES) {
    return { segmented: false, pages: [{ path: INDEX_PAGE, props: whole }], counts: summary };
  }
  const active = summary.filter(({ count }) => count > 0).map(({ letter }) => letter);
  return {
    segmented: true,
    pages: active.flatMap((letter, position) => [
      ...(position === 0 ? [letterPageOf(context, filed, letter, INDEX_PAGE)] : []),
      letterPageOf(context, filed, letter, letterPagePath(letter)),
    ]),
    counts: summary,
  };
}
