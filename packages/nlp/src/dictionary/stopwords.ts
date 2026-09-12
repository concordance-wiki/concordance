import { posix } from "node:path";

import type { Config, FileSystem } from "@concordance-wiki/core";

import { languagePack } from "../locale/registry.js";
import { loadStopwords } from "../locale/stopwords.js";

export interface DictionaryStopwordsInput {
  locale: string;
  config: Config;
  /** The folder of `concordance.yaml`, against which `inference.stopwords` paths resolve. */
  configDirectory: string;
  fs: FileSystem;
}

/**
 * The stopwords excluded from the dictionary of a locale: the pack's defaults plus every
 * file listed under `inference.stopwords`. A missing file is a configuration mistake.
 */
export function dictionaryStopwords(input: DictionaryStopwordsInput): ReadonlySet<string> {
  const words = new Set(languagePack(input.locale).stopwords);
  for (const file of input.config.inference?.stopwords ?? []) {
    const path = posix.resolve(input.configDirectory, file);
    if (!input.fs.exists(path)) {
      throw new Error(`stopword file not found: ${path} (inference.stopwords lists "${file}")`);
    }
    for (const word of loadStopwords(input.fs.readText(path))) words.add(word);
  }
  return words;
}

/** The sources whose entities take priority: `inference.glossary_sources`, else those with `glossary: true`. */
export function glossarySources(config: Config): ReadonlySet<string> {
  const declared = config.inference?.glossary_sources;
  if (declared !== undefined) return new Set(declared);
  return new Set(config.sources.filter((source) => source.glossary === true).map((s) => s.name));
}
