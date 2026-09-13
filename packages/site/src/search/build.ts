import { pagePath, type CanonicalModel, type Entity, type Locale } from "@concordance-wiki/core";
import {
  formatMessage,
  formatNumber,
  type Catalogue,
  type MessageArguments,
  type MessageId,
} from "@concordance-wiki/i18n";

import type { WrittenDocument } from "../build/assemble.js";
import type { SiteNames } from "../build/context.js";
import type { EntityFragment } from "../build/fragments.js";
import { byCodeUnit } from "../order.js";
import { countFacets } from "./facets.js";
import {
  SEARCH_DIRECTORY,
  SEARCH_META,
  shardFile,
  shardOf,
  shardScript,
  type PluralForms,
  type SearchEntry,
  type SearchLabels,
  type SearchMeta,
  type ShardData,
} from "./shared.js";
import { emptyState } from "./state.js";

/** What a query word prefixing a token of the field adds to the score of the entity. */
export const FIELD_WEIGHTS = {
  title: 5,
  aliases: 4,
  summary: 2,
  body: 1,
  type: 1,
  application: 1,
  domain: 1,
  status: 1,
  source: 1,
} as const;

export type SearchFieldName = keyof typeof FIELD_WEIGHTS;

/** `build.extracted_text_max_chars` when the configuration does not set it. */
export const DEFAULT_BODY_MAX_CHARS = 20_000;

/**
 * The tokens of a text in a locale, as the index stores them: the pipeline gives the tokeniser
 * of the language packs, which adds the comparison form of every word to its written form. A
 * query word matches a token by prefix after the normalisation of `normalizeQuery`, so a
 * tokeniser folds case and accents the same way.
 */
export type SearchTokenizer = (text: string, locale: string) => Iterable<string>;

export interface SearchIndexInput {
  model: CanonicalModel;
  /** The fragments of the entities, whose `text` is the body indexed. */
  fragments: ReadonlyMap<string, EntityFragment>;
  tokenize: SearchTokenizer;
  /** The label of a type in the site language, `keyword` included. */
  typeLabel: (type: string) => string;
  /** The strings of the results page, from `searchLabels`. */
  labels: SearchLabels;
  /** The locale the counts are pluralised in. */
  locale: Locale;
  names?: SiteNames;
  /** Characters of the body text indexed per entity, the rest being cut. */
  bodyMaxChars?: number;
}

export interface SearchIndex {
  meta: SearchMeta;
  /** By shard name, sorted; every token of a shard sorted, its pairs in entity order. */
  shards: Map<string, ShardData>;
}

export interface SearchIndexFiles {
  /** The entity table then the shards, in path order. */
  documents: WrittenDocument[];
  /** Bytes of every file together. */
  bytes: number;
  shards: number;
}

/** The type stored for an entity: `keyword` for a keyword page, which has no type of its own. */
export function searchType(entity: Entity): string {
  return entity.keyword === true ? "keyword" : entity.type;
}

/** The text of every indexed field of an entity; the body cut at `bodyMaxChars` characters. */
export function searchFields(
  entity: Entity,
  fragment: EntityFragment | undefined,
  bodyMaxChars: number,
): Record<SearchFieldName, string> {
  return {
    title: entity.title,
    aliases: entity.aliases.join("\n"),
    summary: entity.summary ?? "",
    body: Array.from(fragment?.text ?? "")
      .slice(0, bodyMaxChars)
      .join(""),
    type: searchType(entity),
    application: entity.application ?? "",
    domain: entity.domain ?? "",
    status: entity.status,
    source: entity.source.name,
  };
}

function entryOf(entity: Entity): SearchEntry {
  return {
    id: entity.id,
    title: entity.title,
    type: searchType(entity),
    url: pagePath(entity.id),
    ...(entity.application === undefined ? {} : { application: entity.application }),
    ...(entity.domain === undefined ? {} : { domain: entity.domain }),
    status: entity.status,
    source: entity.source.name,
  };
}

function labelled(
  values: Iterable<string | undefined>,
  label: (value: string) => string,
): Record<string, string> {
  const table: Record<string, string> = {};
  for (const value of [...new Set(values)].filter((v) => v !== undefined).sort(byCodeUnit)) {
    table[value] = label(value);
  }
  return table;
}

/** A message taking a `count`, whose plural forms the table freezes. */
type CountMessage = {
  [Id in keyof MessageArguments]: MessageArguments[Id] extends { count: number } ? Id : never;
}[keyof MessageArguments];

/**
 * Counts whose plural categories, together, reach every category a language declares: the
 * first of them in a category is formatted, the second is what the browser sees as `#`.
 */
const PLURAL_SAMPLES = [1, 2, 0, 3, 5, 11, 100, 1_000_000];

/**
 * The plural forms of a message: one text per category of the locale, formatted with a count of
 * that category, the count then replaced by `#` for the browser to fill in with its own.
 */
export function pluralForms(catalogue: Catalogue, id: CountMessage): PluralForms {
  const rules = new Intl.PluralRules(catalogue.locale);
  const forms: PluralForms = {};
  for (const category of [...rules.resolvedOptions().pluralCategories].sort(byCodeUnit)) {
    const sample = PLURAL_SAMPLES.find((count) => rules.select(count) === category);
    if (sample === undefined) continue;
    forms[category] = formatMessage(catalogue, id, { count: sample }).replaceAll(
      formatNumber(catalogue.locale, sample),
      "#",
    );
  }
  return forms;
}

function plain(catalogue: Catalogue, id: Exclude<MessageId, keyof MessageArguments>): string {
  return formatMessage(catalogue, id);
}

/** The strings of the results page in the language of the catalogue, as the table freezes them. */
export function searchLabels(catalogue: Catalogue): SearchLabels {
  return {
    facets: plain(catalogue, "search.facets"),
    facet: {
      type: plain(catalogue, "search.facet.type"),
      source: plain(catalogue, "search.facet.source"),
      domain: plain(catalogue, "search.facet.domain"),
      application: plain(catalogue, "search.facet.application"),
    },
    activeFilters: plain(catalogue, "search.activeFilters"),
    removeFilter: plain(catalogue, "search.removeFilter"),
    clear: plain(catalogue, "search.clear"),
    noResult: plain(catalogue, "search.noResult"),
    results: pluralForms(catalogue, "search.results"),
  };
}

/** The compact JSON of an object, keys in code-unit order, so that two builds write the same bytes. */
export function compactJson(value: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(byCodeUnit)) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

/**
 * The inverted index of a model: for every entity, the tokens of every indexed field with the
 * sum of the weights of the fields carrying them, grouped into shards by their first characters.
 */
export function buildSearchIndex(input: SearchIndexInput): SearchIndex {
  const bodyMaxChars = input.bodyMaxChars ?? DEFAULT_BODY_MAX_CHARS;
  const weights = new Map<string, Map<number, number>>();
  const entities = input.model.entities;
  entities.forEach((entity, index) => {
    const fields = searchFields(entity, input.fragments.get(entity.id), bodyMaxChars);
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      // The keys of FIELD_WEIGHTS are the fields, by construction.
      for (const token of new Set(
        input.tokenize(fields[field as SearchFieldName], entity.locale),
      )) {
        const byEntity = weights.get(token) ?? new Map<number, number>();
        byEntity.set(index, (byEntity.get(index) ?? 0) + weight);
        weights.set(token, byEntity);
      }
    }
  });
  // Tokens in code-unit order visit the shard names in the same order: the map is sorted as built.
  const shards = new Map<string, ShardData>();
  for (const [token, byEntity] of [...weights].sort(([a], [b]) => byCodeUnit(a, b))) {
    const name = shardOf(token);
    const shard = shards.get(name) ?? {};
    // Entities were visited in table order, so the pairs are already ascending.
    shard[token] = [...byEntity];
    shards.set(name, shard);
  }
  const entries = entities.map(entryOf);
  const names = input.names ?? {};
  let bytes = 0;
  for (const [name, shard] of shards) {
    bytes += Buffer.byteLength(shardScript(name, compactJson(shard)));
  }
  return {
    meta: {
      entities: entries,
      shards: [...shards.keys()],
      types: labelled(
        entries.map((entry) => entry.type),
        (type) => input.typeLabel(type),
      ),
      applications: labelled(
        entries.map((entry) => entry.application),
        (id) => names.applications?.[id] ?? id,
      ),
      domains: labelled(
        entries.map((entry) => entry.domain),
        (id) => names.domains?.[id] ?? id,
      ),
      sources: labelled(
        entries.map((entry) => entry.source),
        (name) => name,
      ),
      counts: countFacets(entries, emptyState()),
      labels: input.labels,
      locale: input.locale,
      bytes,
    },
    shards,
  };
}

/** The path of an index file under the output folder. */
export function searchFilePath(name: string): string {
  return `${SEARCH_DIRECTORY}/${shardFile(name)}.js`;
}

/** The index as files: `search/meta.js` and one `search/<shard>.js` per shard, each a classic script. */
export function searchIndexFiles(index: SearchIndex): SearchIndexFiles {
  const documents: WrittenDocument[] = [
    {
      path: searchFilePath(SEARCH_META),
      content: shardScript(SEARCH_META, compactJson({ ...index.meta })),
    },
    ...[...index.shards].map(([name, shard]) => ({
      path: searchFilePath(name),
      content: shardScript(name, compactJson(shard)),
    })),
  ];
  return {
    documents,
    bytes: documents.reduce((total, document) => total + Buffer.byteLength(document.content), 0),
    shards: index.shards.size,
  };
}
