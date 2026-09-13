import type { Entity } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import type { IndexEntry, IndexLetter, IndexProps } from "../slots.js";
import { citations, glyphOf, type SiteContext } from "./context.js";
import { entityHref, INDEX_PAGE, relativeHref } from "./paths.js";

/** The letters of the navigation; titles opening otherwise gather under the last one. */
export const INDEX_LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(/(?=.)/u), "#"];

/** Past this weight of the whole index, rendered as one page, every letter gets a page of its own. */
export const INDEX_SEGMENT_BYTES = 100_000;

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

function entryOf(context: SiteContext, from: string, entity: Entity, anchor?: string): IndexEntry {
  const glyph = entity.keyword === true ? undefined : glyphOf(context, entity.type);
  return {
    label: entity.title,
    href: entityHref(from, entity.id),
    ...(glyph === undefined ? {} : { glyph }),
    ...(anchor === undefined ? {} : { anchor }),
    count: citations(context, entity.id),
  };
}

function countsOf(filed: Filed[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { letter } of filed) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

/** The letter bar seen from a page: a letter with entries links to its place, the others stay inactive. */
function lettersOf(from: string, counts: Map<string, number>, segmented: boolean): IndexLetter[] {
  return INDEX_LETTERS.map((letter) => {
    const count = counts.get(letter) ?? 0;
    return count === 0
      ? { letter, count }
      : { letter, href: letterHref(from, letter, segmented), count };
  });
}

/** The whole index in one page, the first entry of every letter anchored for the bar. */
export function indexOf(context: SiteContext, filed = filedEntities(context)): IndexProps {
  const counts = countsOf(filed);
  const seen = new Set<string>();
  const entries = filed.map(({ entity, letter }) => {
    const first = !seen.has(letter);
    seen.add(letter);
    return entryOf(context, INDEX_PAGE, entity, first ? letterSlug(letter) : undefined);
  });
  return { letters: lettersOf(INDEX_PAGE, counts, false), entries };
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
      letters: lettersOf(path, countsOf(filed), true),
      current: letter,
      entries: filed
        .filter((item) => item.letter === letter)
        .map(({ entity }) => entryOf(context, path, entity)),
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
