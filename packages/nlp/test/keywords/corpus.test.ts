import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config } from "@concordance-wiki/core";
import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";
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
  undefinedTermFindings,
  type DictionarySource,
  type KeywordCandidate,
  type KeywordUnit,
} from "../../src/index.js";

interface Expectation {
  text: string;
  min_occurrences?: number;
  min_files?: number;
  reason?: string;
}

interface ExpectedKeywords {
  published: Expectation[];
  unpublished: Expectation[];
}

interface Corpus {
  config: Config;
  entities: DictionarySource[];
  units: KeywordUnit[];
  expected: ExpectedKeywords;
  configDirectory: string;
}

function readCorpus(locale: string): Corpus {
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

function discover(corpus: Corpus): KeywordCandidate[] {
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
    pack,
    dictionaryKeys: new Set(dictionary.entries.keys()),
  });
}

describe.each(["en", "fr"])("the recurring expressions of the minimal %s corpus", (locale) => {
  const corpus = readCorpus(locale);
  const candidates = discover(corpus);
  const pack = languagePack(locale);

  it("lists every published expression above the thresholds with at least the expected counts", () => {
    for (const expectation of corpus.expected.published) {
      const candidate = candidates.find((c) => c.key === pack.normalize(expectation.text));
      expect(candidate, expectation.text).toBeDefined();
      expect(candidate?.occurrences).toBeGreaterThanOrEqual(expectation.min_occurrences ?? 0);
      expect(candidate?.documents).toBeGreaterThanOrEqual(expectation.min_files ?? 0);
    }
  });

  it("lists no unpublished expression", () => {
    for (const expectation of corpus.expected.unpublished) {
      const keys = candidates.map((c) => c.key);
      expect(keys, expectation.reason).not.toContain(pack.normalize(expectation.text));
    }
  });

  it("ranks the published expression first, with its display form and its mentions in order", () => {
    const [first] = candidates;
    const [published] = corpus.expected.published;
    expect(first?.key).toBe(pack.normalize(published?.text ?? ""));
    expect(first?.display).toBe(published?.text);
    expect(first?.words).toBe(2);
    expect(first?.score).toBe(13.8621);
    const files = first?.mentions.map((mention) => `${mention.source ?? ""}/${mention.path}`) ?? [];
    expect(files).toEqual([...files].sort());
    expect(new Set(files).size).toBe(first?.documents);
    for (const mention of first?.mentions ?? []) {
      expect(mention.context.length).toBeLessThanOrEqual(162);
      expect(pack.normalize(mention.context)).toContain(first?.key.split(" ")[0]);
    }
  });

  it("never lists the words of a defined term or a lone stopword", () => {
    const keys = candidates.map((c) => c.key);
    expect(keys).not.toContain("payment");
    expect(keys).not.toContain("versement");
    expect(keys.some((key) => pack.stopwords.has(key))).toBe(false);
  });

  it("reports every published expression as an undefined term above the configured score", () => {
    const options = keywordOptions(corpus.config);
    const findings = undefinedTermFindings(candidates, { minScore: options.minScore });
    const reported = findings.map((finding) => finding.message);
    for (const expectation of corpus.expected.published) {
      expect(reported.some((message) => message.includes(`"${expectation.text}"`))).toBe(true);
    }
  });
});
