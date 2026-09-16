import { resolve } from "node:path";

import type { CanonicalModel, Config, Entity } from "@concordance-wiki/core";
import { glossarySources, languagePack, searchTokens } from "@concordance-wiki/nlp";
import {
  buildSearchIndex,
  countFacets,
  emptyState,
  filterEntries,
  fragmentPath,
  queryWords,
  rank,
  SEARCH_META,
  searchFilePath,
  shardOf,
  type EntityFragment,
  type FacetCounts,
  type SearchEntry,
  type SearchMeta,
  type SearchState,
  type ShardData,
} from "@concordance-wiki/site";

import type { CommandIo } from "../io.js";
import { siteNames } from "../commands/render.js";
import type { ListFilters } from "./list.js";
import type { LocatedModel } from "./locate.js";

/** Where the index came from: the files of the site, the fragments next to the model, or the model alone. */
export type IndexOrigin = "site" | "fragments" | "model";

export interface SearchIndexSource {
  meta: SearchMeta;
  /** The shards a query needs, by name; those the source has not, empty. */
  shardsFor: (names: readonly string[]) => Map<string, ShardData>;
  origin: IndexOrigin;
}

/** The JSON a shard file wraps: `window.__concordanceSearch.shard("name",<json>);`. */
function unwrapShard(script: string): unknown {
  const start = script.indexOf(",");
  const end = script.lastIndexOf(")");
  return JSON.parse(script.slice(start + 1, end));
}

/** The index the site wrote next to the model, read file by file as the browser would. */
function fromSite(io: CommandIo, directory: string): SearchIndexSource | undefined {
  const metaFile = resolve(directory, searchFilePath(SEARCH_META));
  if (!io.fs.exists(metaFile)) return undefined;
  const meta = unwrapShard(io.fs.readText(metaFile)) as SearchMeta;
  return {
    meta,
    origin: "site",
    shardsFor: (names) => {
      const shards = new Map<string, ShardData>();
      for (const name of names) {
        const file = resolve(directory, searchFilePath(name));
        if (io.fs.exists(file)) shards.set(name, unwrapShard(io.fs.readText(file)) as ShardData);
      }
      return shards;
    },
  };
}

/** The fragments written next to the model, for the entities that have one. */
function readFragments(
  io: CommandIo,
  directory: string,
  model: CanonicalModel,
): Map<string, EntityFragment> {
  const fragments = new Map<string, EntityFragment>();
  for (const entity of model.entities) {
    const file = resolve(directory, fragmentPath(entity.id));
    if (io.fs.exists(file))
      fragments.set(entity.id, JSON.parse(io.fs.readText(file)) as EntityFragment);
  }
  return fragments;
}

/** The index built as the site builds it, from the model and its fragments, with what the configuration gives when it is known. */
function fromModel(
  io: CommandIo,
  located: LocatedModel,
  fragments: Map<string, EntityFragment>,
  origin: IndexOrigin,
): SearchIndexSource {
  const config: Config | undefined = located.config;
  const { meta, shards } = buildSearchIndex({
    model: located.model,
    fragments,
    tokenize: (text, locale) => searchTokens(text, languagePack(locale)),
    typeLabel: (type) => type,
    locale: config?.project.locale ?? "en",
    ...(config === undefined
      ? {}
      : {
          names: siteNames(config),
          glossarySources: [...glossarySources(config)],
          ...(config.build?.extracted_text_max_chars === undefined
            ? {}
            : { bodyMaxChars: config.build.extracted_text_max_chars }),
        }),
  });
  return {
    meta,
    origin,
    shardsFor: (names) =>
      new Map(
        names.flatMap((name) => (shards.has(name) ? [[name, shards.get(name) as ShardData]] : [])),
      ),
  };
}

/**
 * The index a query searches, in this order: the files the site wrote next to the model, the
 * same files as the browser loads; else the index built from the model and the fragments next to
 * it; else, with the model alone, an index of the titles, aliases and summaries, which the answer says.
 */
export function loadSearchIndex(io: CommandIo, located: LocatedModel): SearchIndexSource {
  const { directory } = located;
  if (directory !== undefined) {
    const site = fromSite(io, directory);
    if (site !== undefined) return site;
    const fragments = readFragments(io, directory, located.model);
    if (fragments.size > 0) return fromModel(io, located, fragments, "fragments");
  }
  return fromModel(io, located, new Map(), "model");
}

export interface SearchOptions {
  filters: ListFilters;
  /** `only` keeps the keyword pages alone, `exclude` leaves them out, `any` keeps every entry. */
  noteless: SearchState["noteless"];
  limit: number;
}

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

export interface SearchAnswer {
  query: string;
  /** The words looked up, as the site normalises them; empty when the query holds none long enough. */
  words: string[];
  origin: IndexOrigin;
  hits: SearchHit[];
  /** Hits the bound left out. */
  more: number;
  /** The counts of every facet value over the whole result, before the bound. */
  facets: FacetCounts;
}

/** The results of a query, ranked as the results page ranks them, filtered by the facets, counted before the bound. */
export function searchIndex(
  source: SearchIndexSource,
  query: string,
  options: SearchOptions,
): SearchAnswer {
  const words = queryWords(query);
  const { meta } = source;
  const state: SearchState = {
    ...emptyState(),
    filters: {
      type: options.filters.type === undefined ? [] : [options.filters.type],
      source: options.filters.source === undefined ? [] : [options.filters.source],
      domain: options.filters.domain === undefined ? [] : [options.filters.domain],
      application: options.filters.application === undefined ? [] : [options.filters.application],
    },
    noteless: options.noteless,
  };
  const shards = source.shardsFor(words.map(shardOf));
  const ranked = rank(words, shards, {
    keyword: (entity) => meta.entities[entity]?.keyword === true,
    cited: (entity) => meta.entities[entity]?.cited ?? 0,
  }).flatMap(({ entity, score }) => {
    const entry = meta.entities[entity];
    return entry === undefined ? [] : [{ entry, score }];
  });
  const kept = words.length === 0 ? [] : filterEntries(ranked, (hit) => hit.entry, state);
  return {
    query,
    words,
    origin: source.origin,
    hits: kept.slice(0, options.limit),
    more: Math.max(0, kept.length - options.limit),
    // Each facet is counted under the filters of the others, so that a second value of a facet stays selectable.
    facets: countFacets(
      ranked.map((hit) => hit.entry),
      state,
    ),
  };
}

/** The entity of a hit, when the model holds it: a hit is a row of the index, the model the reference. */
export function entityOfHit(model: CanonicalModel, hit: SearchHit): Entity | undefined {
  return model.entities.find((entity) => entity.id === hit.entry.id);
}
