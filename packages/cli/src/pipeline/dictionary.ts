import type { Config, Entity, FileSystem, Finding } from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import {
  buildDictionary,
  dictionaryStopwords,
  glossarySources,
  type Dictionary,
} from "@concordance-wiki/nlp";

export interface BuildDictionariesInput {
  entities: readonly Entity[];
  /** The ingested sources; their locales decide how many dictionaries are built. */
  sources: readonly IngestedSource[];
  config: Config;
  /** The folder of `concordance.yaml`, against which `inference.stopwords` paths resolve. */
  configDirectory: string;
  fs: FileSystem;
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
 * The recognition dictionary of every locale of the corpus: the titles and aliases of its entities,
 * the stopwords of its language pack and of `inference.stopwords`, the glossary sources first.
 */
export function buildDictionaries(input: BuildDictionariesInput): Dictionaries {
  const { config } = input;
  const glossary = glossarySources(config);
  const shortTerms = new Set(config.inference?.short_terms ?? []);
  const entities = input.entities.map((entity) => ({
    id: entity.id,
    source: entity.source.name,
    type: entity.type,
    title: entity.title,
    aliases: entity.aliases,
    locale: entity.locale,
  }));
  const byLocale = new Map<string, LocaleDictionary>();
  const findings: Finding[] = [];
  for (const locale of corpusLocales(input.sources)) {
    const stopwords = dictionaryStopwords({
      locale,
      config,
      configDirectory: input.configDirectory,
      fs: input.fs,
    });
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
