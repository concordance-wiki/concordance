/**
 * What the index builder and the island in the browser share: the layout of the index files,
 * the normalisation of a query and the ranking. Nothing here reaches Node, so that the same
 * module is bundled into the island.
 */

import type { SearchField, SearchResultsProps } from "../slots.js";

/** Folder of the index under the output folder; also the folder of the results page. */
export const SEARCH_DIRECTORY = "search";
/** The island of the header field and of the results page; one bundle wires both. */
export const SEARCH_ISLAND = "search";
/** The suggestions under the header field are rendered into the element of this class by the island. */
export const SUGGESTIONS_CLASS = "search-suggestions";
/** Name of the entity table file, `search/meta.js`; never a shard name, which is at most two characters. */
export const SEARCH_META = "meta";
/** The global the shard files call back: `window.__concordanceSearch.shard(name, data)`. */
export const SEARCH_GLOBAL = "__concordanceSearch";
/** A shard gathers every token sharing its first characters; a query word shorter than this is not looked up. */
export const SHARD_PREFIX_LENGTH = 2;

/**
 * What the client entry reads from an island: the field of the header, with the root of the
 * site where the index lives, or the results of the search page, which the entry fills from
 * the query in the address and as the reader types.
 */
export interface SearchIslandProps {
  /** Href of the root of the site from the page; absent when there is no index to load. */
  root?: string;
  search?: SearchField;
  results?: SearchResultsProps;
}

/** One row of the entity table, in model order; the client turns `url` into an href from its page. */
export interface SearchEntry {
  id: string;
  title: string;
  /** The type of the entity, `keyword` for a keyword page. */
  type: string;
  /** Path of the page under the output folder. */
  url: string;
  application?: string;
  domain?: string;
  status: string;
  source: string;
}

/** The facets of the results page, in the order they are shown; each one filters on the field of the same name. */
export const FACET_NAMES = ["type", "source", "domain", "application"] as const;

export type FacetName = (typeof FACET_NAMES)[number];

/**
 * A plural message frozen at build for the browser: the text of every plural category of the
 * locale, `#` standing for the number; `plural` picks the category with `Intl.PluralRules`.
 */
export type PluralForms = Record<string, string>;

/** The strings of the results page, formatted at build in the site language and written in the table. */
export interface SearchLabels {
  /** Heading of the facets. */
  facets: string;
  /** Heading of every facet, by name. */
  facet: Record<FacetName, string>;
  activeFilters: string;
  removeFilter: string;
  clear: string;
  noResult: string;
  /** "N results", by plural category. */
  results: PluralForms;
  /** The line showing the address of the search, its copy button and the status once copied. */
  address: string;
  copyAddress: string;
  copied: string;
}

/** The number of entities carrying every value of every facet, values in code-unit order. */
export type FacetCounts = Record<FacetName, Record<string, number>>;

export interface SearchMeta {
  entities: SearchEntry[];
  /** Every shard written, sorted, so that the client never asks for one that does not exist. */
  shards: string[];
  /** Labels of the types, titles of the applications and domains, by identifier, in the site language. */
  types: Record<string, string>;
  applications: Record<string, string>;
  domains: Record<string, string>;
  /** The declared sources, each labelled by its name, so that the facet lists them like the others. */
  sources: Record<string, string>;
  /** The counts of every facet value over the whole table: what the results page shows before a query. */
  counts: FacetCounts;
  labels: SearchLabels;
  /** BCP 47 tag of the site, for the plural rules of the counts. */
  locale: string;
  /** Bytes of every shard file together; the entity table is not counted in itself. */
  bytes: number;
}

/** The text of a plural message for a count: the category's text, `other` when the locale has none for it, the number written in the locale. */
export function plural(forms: PluralForms, count: number, locale: string): string {
  const text = forms[new Intl.PluralRules(locale).select(count)] ?? forms["other"] ?? "";
  return text.replaceAll("#", new Intl.NumberFormat(locale).format(count));
}

/** Token to its `[entity index, weight]` pairs, indices ascending. */
export type ShardData = Record<string, [number, number][]>;

const combiningMarks = /\p{M}+/gu;
const apostrophes = /[’ʼ]/g;
const edges = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * The form a query is compared on, the same the language packs give to the indexed text: case
 * and accents folded, typographic apostrophes unified, whitespace collapsed.
 */
export function normalizeQuery(text: string): string {
  return text
    .normalize("NFD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(apostrophes, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Punctuation trimmed at both ends of a word; the inside stays so that a hyphenated word is one token. */
export function trimEdges(word: string): string {
  return word.replace(edges, "");
}

/** The words of a query that are looked up, in order, without repetition; a word too short for a shard is dropped. */
export function queryWords(query: string): string[] {
  const words: string[] = [];
  for (const raw of normalizeQuery(query).split(" ")) {
    const word = trimEdges(raw);
    if (word.length >= SHARD_PREFIX_LENGTH && !words.includes(word)) {
      words.push(word);
    }
  }
  return words;
}

/** The shard a token belongs to: its first characters. */
export function shardOf(token: string): string {
  return Array.from(token).slice(0, SHARD_PREFIX_LENGTH).join("");
}

/**
 * File name of a shard or of the entity table under `search/`, without extension: letters and
 * digits stay, any other character becomes `_` and its code point, so that the name is safe on
 * every file system and in a URL.
 */
export function shardFile(name: string): string {
  return Array.from(name)
    .map((character) =>
      /[a-z0-9]/.test(character)
        ? character
        : // A character spread from a string always has a code point.
          `_${(character.codePointAt(0) as number).toString(16).padStart(4, "0")}`,
    )
    .join("");
}

/** The href of an index file from a page, given the href of the `search/` folder from that page. */
export function shardHref(index: string, name: string): string {
  return `${index}${shardFile(name)}.js`;
}

/** The text of a shard file: a classic script calling the global back, so that it loads over `file://` as behind a server. */
export function shardScript(name: string, json: string): string {
  return `window.${SEARCH_GLOBAL}.shard(${JSON.stringify(name)},${json});\n`;
}

export interface Ranked {
  /** Index in the entity table. */
  entity: number;
  score: number;
}

/**
 * The entities matching every word of the query as a prefix of one of their tokens, best first:
 * each word counts the heaviest token it prefixes, the score is their sum, and ties keep the
 * table order. The shards given are those of the words; a word without a shard matches nothing.
 */
export function rank(words: readonly string[], shards: ReadonlyMap<string, ShardData>): Ranked[] {
  let scores: Map<number, number> | undefined;
  for (const word of words) {
    const best = new Map<number, number>();
    const shard = shards.get(shardOf(word)) ?? {};
    for (const [token, pairs] of Object.entries(shard)) {
      if (!token.startsWith(word)) continue;
      for (const [entity, weight] of pairs) {
        best.set(entity, Math.max(best.get(entity) ?? 0, weight));
      }
    }
    if (scores === undefined) {
      scores = best;
      continue;
    }
    const kept = new Map<number, number>();
    for (const [entity, score] of scores) {
      const weight = best.get(entity);
      if (weight !== undefined) kept.set(entity, score + weight);
    }
    scores = kept;
  }
  return [...(scores ?? new Map<number, number>())]
    .map(([entity, score]) => ({ entity, score }))
    .sort((a, b) => b.score - a.score || a.entity - b.entity);
}
