import type { Config, Entity, FileSystem, Finding } from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import {
  buildDictionary,
  dictionaryStopwords,
  glossarySources,
  type Dictionary,
  type DictionarySource,
} from "@concordance-wiki/nlp";

import type { FoldedEntity } from "./duplicates.js";

export interface CorpusStopwordsInput {
  /** The ingested sources; their locales decide how many sets are read. */
  sources: readonly IngestedSource[];
  config: Config;
  /** The folder of `concordance.yaml`, against which `inference.stopwords` paths resolve. */
  configDirectory: string;
  fs: FileSystem;
}

export interface BuildDictionariesInput {
  entities: readonly Entity[];
  /** The twins the reconciliation folded into an entity: their titles and aliases name that entity. */
  folded?: readonly FoldedEntity[];
  config: Config;
  /** The stopwords of every locale of the corpus, as `corpusStopwords` reads them; one dictionary per locale. */
  stopwords: ReadonlyMap<string, ReadonlySet<string>>;
}

/** What the recognition of one locale rests on: its dictionary and the stopwords that shaped it. */
export interface LocaleDictionary {
  dictionary: Dictionary;
  /** The pack's defaults merged with the files of `inference.stopwords`, as written. */
  stopwords: ReadonlySet<string>;
}

export interface Dictionaries {
  /** One entry per locale of the corpus, locales in code-unit order. */
  byLocale: ReadonlyMap<string, LocaleDictionary>;
  /** The homonym findings of every dictionary. */
  findings: Finding[];
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** The distinct locales of the sources, sorted. */
export function corpusLocales(sources: readonly IngestedSource[]): string[] {
  return [...new Set(sources.map((source) => source.locale))].sort(byCodeUnit);
}

/**
 * The stopwords of every locale of the corpus, locales in code-unit order: the defaults of the
 * language pack merged with the files of `inference.stopwords`. Read once, before the twin
 * reconciliation compares texts and the dictionaries are built.
 */
export function corpusStopwords(input: CorpusStopwordsInput): Map<string, ReadonlySet<string>> {
  const byLocale = new Map<string, ReadonlySet<string>>();
  for (const locale of corpusLocales(input.sources)) {
    byLocale.set(
      locale,
      dictionaryStopwords({
        locale,
        config: input.config,
        configDirectory: input.configDirectory,
        fs: input.fs,
      }),
    );
  }
  return byLocale;
}

function dictionarySource(entity: Entity, id: string): DictionarySource {
  return {
    id,
    source: entity.source.name,
    path: entity.source.path,
    type: entity.type,
    title: entity.title,
    aliases: entity.aliases,
    locale: entity.locale,
  };
}

/**
 * The recognition dictionary of every locale of the corpus: the titles and aliases of its entities,
 * the stopwords of its language pack and of `inference.stopwords`, the glossary sources first. A
 * twin folded into an entity lends it its titles and aliases: a form the two share names the
 * entity once and is no homonym.
 */
export function buildDictionaries(input: BuildDictionariesInput): Dictionaries {
  const { config } = input;
  const glossary = glossarySources(config);
  const shortTerms = new Set(config.inference?.short_terms ?? []);
  const entities = [
    ...input.entities.map((entity) => dictionarySource(entity, entity.id)),
    ...(input.folded ?? []).map((twin) => dictionarySource(twin.entity, twin.into)),
  ];
  const byLocale = new Map<string, LocaleDictionary>();
  const findings: Finding[] = [];
  for (const [locale, stopwords] of input.stopwords) {
    const dictionary = buildDictionary({
      entities,
      locale,
      glossarySources: glossary,
      stopwords,
      shortTerms,
    });
    byLocale.set(locale, { dictionary, stopwords });
    findings.push(...dictionary.findings);
  }
  return { byLocale, findings };
}
