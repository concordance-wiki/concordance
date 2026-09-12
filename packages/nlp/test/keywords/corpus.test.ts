import { describe, expect, it } from "vitest";

import { keywordOptions, languagePack, undefinedTermFindings } from "../../src/index.js";
import { discover, readCorpus } from "./minimal-corpus.js";

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
