import { pagePath, type CanonicalModel, type Entity } from "@concordance-wiki/core";

import type { WrittenDocument } from "../build/assemble.js";
import type { SiteNames } from "../build/context.js";
import type { EntityFragment } from "../build/fragments.js";
import { byCodeUnit } from "../order.js";
import {
  SEARCH_DIRECTORY,
  SEARCH_META,
  shardFile,
  shardOf,
  shardScript,
  type SearchEntry,
  type SearchMeta,
  type ShardData,
} from "./shared.js";

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
