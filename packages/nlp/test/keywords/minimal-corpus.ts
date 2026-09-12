import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config } from "@concordance-wiki/core";
import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";
import { parse } from "yaml";

import {
  buildDictionary,
  dictionaryStopwords,
  extractNgrams,
  glossarySources,
  keywordOptions,
  languagePack,
  resolveLocale,
  scoreCandidates,
  type DictionarySource,
  type KeywordCandidate,
  type KeywordUnit,
  type ScoreCandidatesOptions,
} from "../../src/index.js";

export interface Expectation {
  text: string;
  min_occurrences?: number;
  min_files?: number;
  reason?: string;
}

export interface ExpectedKeywords {
  published: Expectation[];
  unpublished: Expectation[];
}

export interface Corpus {
  config: Config;
  entities: DictionarySource[];
  units: KeywordUnit[];
  expected: ExpectedKeywords;
  configDirectory: string;
}

export function readCorpus(locale: string): Corpus {
  const root = fileURLToPath(
    new URL(`../../../../fixtures/corpora/minimal/${locale}/`, import.meta.url),
  );
  const parsed = parseConfig(nodeFileSystem.readText(`${root}concordance.yaml`));
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  const { config } = parsed;
  const entities: DictionarySource[] = [];
  const units: KeywordUnit[] = [];
  for (const source of config.sources) {
    const directory = `${root}${(source.path ?? "").replace(/^\.\//, "")}`;
    const sourceLocale = resolveLocale(source, config.project);
    for (const path of nodeFileSystem.listFiles(directory).filter((p) => p.endsWith(".md"))) {
      const document = parseMarkdown(nodeFileSystem.readText(`${directory}/${path}`), { path });
      const aliases = document.frontmatter["aliases"];
      entities.push({
        id: `${source.name}/${path}`,
        source: source.name,
        type: "document",
        title: document.title ?? "",
        aliases: Array.isArray(aliases) ? aliases.map(String) : [],
        locale: sourceLocale,
      });
      for (const unit of scannableText(document)) {
        units.push({ source: source.name, path, line: unit.line, text: unit.text });
      }
    }
  }
  // The expectation file is a fixture of the repository, shaped as the test reads it.
  const expected = parse(
    nodeFileSystem.readText(`${root}expected/keywords.yaml`),
  ) as ExpectedKeywords;
  return { config, entities, units, expected, configDirectory: root };
}

/** Runs the discovery on the corpus; `thresholds` overrides those of its configuration. */
export function discover(
  corpus: Corpus,
  thresholds: Partial<Pick<ScoreCandidatesOptions, "minOccurrences" | "minDocuments">> = {},
): KeywordCandidate[] {
  const locale = resolveLocale({}, corpus.config.project);
  const pack = languagePack(locale);
  const stopwords = dictionaryStopwords({
    locale,
    config: corpus.config,
    configDirectory: corpus.configDirectory,
    fs: nodeFileSystem,
  });
  const dictionary = buildDictionary({
    entities: corpus.entities,
    locale,
    glossarySources: glossarySources(corpus.config),
    stopwords,
    shortTerms: new Set(),
  });
  const options = keywordOptions(corpus.config);
  const ngrams = extractNgrams(corpus.units, pack, { ...options, stopwords });
  return scoreCandidates(ngrams, {
    ...options,
    ...thresholds,
    pack,
    dictionaryKeys: new Set(dictionary.entries.keys()),
  });
}
