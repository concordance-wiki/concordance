import { summarize, type Config, type Entity } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  KEYWORD_TYPE,
  keywordEntities,
  keywordPublicationDefaults,
  keywordPublicationOptions,
  languagePack,
  publishKeywords,
  type KeywordCandidate,
  type KeywordMention,
  type KeywordPage,
  type PublishedKeywords,
} from "../../src/index.js";
import { discover, readCorpus } from "./minimal-corpus.js";

const config: Config = { version: 1, project: { name: "Minimal" }, sources: [] };

function mention(source: string, path: string, line: number): KeywordMention {
  return { source, path, line, position: 0, surface: path, context: `…${path}…` };
}

/** A candidate with `occurrences` mentions spread over `documents` files, cycling through them. */
function candidate(
  key: string,
  counts: { occurrences: number; documents: number },
  score: number,
): KeywordCandidate {
  const mentions: KeywordMention[] = [];
  for (let index = 0; index < counts.occurrences; index += 1) {
    const file = `note-${String(index % counts.documents)}.md`;
    mentions.push(mention("notes", file, index + 1));
  }
  return { key, display: key, words: key.split(" ").length, ...counts, score, mentions };
}

const summary = candidate("build summary", { occurrences: 4, documents: 3 }, 13.8621);
const cold = candidate("cold start", { occurrences: 2, documents: 2 }, 2.1);
const nightly = candidate("nightly batch", { occurrences: 3, documents: 1 }, 5.5);
const threshold = { minOccurrences: 3, minFiles: 2 };

describe("publishKeywords", () => {
  it("generates a keyword page only from three occurrences in at least two distinct files", () => {
    const exactly = candidate("related cap", { occurrences: 3, documents: 2 }, 4.2);
    const result = publishKeywords([summary, cold, nightly, exactly], threshold);
    expect(result.published.map((page) => page.key)).toEqual(["build summary", "related cap"]);
    expect(result.discarded.map((page) => page.key)).toEqual(["nightly batch", "cold start"]);
  });

  it("keeps an expression below the threshold findable through search but without a page", () => {
    const result = publishKeywords([cold], threshold);
    expect(result.published).toEqual([]);
    expect(result.discarded).toEqual([cold]);
    expect(result.discarded[0]?.mentions).toBe(cold.mentions);
  });

  it("addresses every page under keywords/ by the slug of its key, sorted by identifier", () => {
    const accented = candidate("règle d'écrêtage", { occurrences: 3, documents: 2 }, 9);
    const result = publishKeywords([summary, accented], threshold);
    const expected: KeywordPage = {
      id: "keywords/build-summary",
      key: "build summary",
      display: "build summary",
      occurrences: 4,
      documents: 3,
      score: 13.8621,
      mentions: summary.mentions,
    };
    expect(result.published).toEqual([
      expected,
      expect.objectContaining({ id: "keywords/regle-d-ecretage" }),
    ]);
  });

  it("suffixes the identifier of a key whose slug is already taken by a better-scored one", () => {
    const spaced = candidate("web site", { occurrences: 3, documents: 2 }, 6);
    const hyphenated = candidate("web-site", { occurrences: 3, documents: 2 }, 7);
    const third = candidate("web_site", { occurrences: 3, documents: 2 }, 5);
    const result = publishKeywords([spaced, hyphenated, third], threshold);
    expect(result.published.map((page) => [page.id, page.key])).toEqual([
      ["keywords/web-site", "web-site"],
      ["keywords/web-site-2", "web site"],
      ["keywords/web-site-3", "web_site"],
    ]);
  });

  it("lists the discarded expressions best score first, then by key", () => {
    const tie = candidate("a tie", { occurrences: 1, documents: 1 }, 5.5);
    const result = publishKeywords([cold, nightly, tie], threshold);
    expect(result.discarded.map((page) => page.key)).toEqual([
      "a tie",
      "nightly batch",
      "cold start",
    ]);
  });

  it("lowering the threshold increases the page count and raising it decreases it", () => {
    const candidates = [
      summary,
      cold,
      nightly,
      candidate("single mention", { occurrences: 1, documents: 1 }, 1),
      candidate("five in three", { occurrences: 5, documents: 3 }, 8),
      candidate("six in two", { occurrences: 6, documents: 2 }, 7),
    ];
    const count = (minOccurrences: number, minFiles: number): number =>
      publishKeywords(candidates, { minOccurrences, minFiles }).published.length;
    const lowered = count(1, 1);
    const standard = count(3, 2);
    const raised = count(5, 3);
    expect(lowered).toBe(6);
    expect(standard).toBe(3);
    expect(raised).toBe(1);
    expect(lowered).toBeGreaterThan(standard);
    expect(standard).toBeGreaterThan(raised);
    expect(publishKeywords(candidates, { minOccurrences: 5, minFiles: 3 }).discarded).toHaveLength(
      5,
    );
  });

  it("leaves the input untouched", () => {
    const candidates = [cold, summary];
    publishKeywords(candidates, threshold);
    expect(candidates.map((c) => c.key)).toEqual(["cold start", "build summary"]);
  });
});

describe("keywordPublicationOptions", () => {
  it("exposes the threshold under inference.keyword_pages as min_occurrences and min_files", () => {
    expect(
      keywordPublicationOptions({
        ...config,
        inference: { keyword_pages: { min_occurrences: 5, min_files: 3 } },
      }),
    ).toEqual({ minOccurrences: 5, minFiles: 3 });
    expect(
      keywordPublicationOptions({ ...config, inference: { keyword_pages: { min_files: 1 } } }),
    ).toEqual({ minOccurrences: 3, minFiles: 1 });
    expect(
      keywordPublicationOptions({
        ...config,
        inference: { keyword_pages: { min_occurrences: 1 } },
      }),
    ).toEqual({ minOccurrences: 1, minFiles: 2 });
  });

  it("defaults to three occurrences in two distinct files", () => {
    expect(keywordPublicationOptions(config)).toEqual({ minOccurrences: 3, minFiles: 2 });
    expect(keywordPublicationOptions({ ...config, inference: {} })).toEqual(threshold);
    expect(keywordPublicationOptions({ ...config, inference: { keyword_pages: {} } })).toEqual(
      threshold,
    );
    expect(keywordPublicationDefaults).toEqual({ minOccurrences: 3, minFiles: 2 });
  });
});

describe("keywordEntities", () => {
  it("turns each page into a term entity marked as a keyword, located on its first mention", () => {
    const pages = publishKeywords([summary], threshold).published;
    const expected: Entity = {
      id: "keywords/build-summary",
      type: "term",
      title: "build summary",
      aliases: [],
      locale: "en",
      status: "valid",
      type_origin: "default",
      graph: "full",
      attributes: { documents: 3, occurrences: 4, score: 13.8621 },
      source: { name: "notes", path: "note-0.md", line: 1 },
      keyword: true,
    };
    expect(keywordEntities(pages, { locale: "en" })).toStrictEqual([expected]);
    expect(KEYWORD_TYPE).toBe("term");
  });

  it("keeps the page order and the locale it is given", () => {
    const pages = publishKeywords(
      [summary, candidate("related cap", { occurrences: 3, documents: 2 }, 4)],
      threshold,
    ).published;
    const entities = keywordEntities(pages, { locale: "fr" });
    expect(entities.map((entity) => entity.id)).toEqual([
      "keywords/build-summary",
      "keywords/related-cap",
    ]);
    expect(entities.map((entity) => entity.locale)).toEqual(["fr", "fr"]);
  });

  it("names an empty source when the first mention carries none", () => {
    const local: KeywordPage = {
      id: "keywords/nightly",
      key: "nightly",
      display: "Nightly",
      occurrences: 3,
      documents: 2,
      score: 5,
      mentions: [
        {
          path: "batches/nightly.md",
          line: 4,
          position: 2,
          surface: "Nightly",
          context: "Nightly",
        },
      ],
    };
    expect(keywordEntities([local], { locale: "en" })[0]?.source).toEqual({
      name: "",
      path: "batches/nightly.md",
      line: 4,
    });
  });

  it("refuses a page without any mention, which nothing could locate", () => {
    const orphan: KeywordPage = {
      id: "keywords/orphan",
      key: "orphan",
      display: "orphan",
      occurrences: 3,
      documents: 2,
      score: 5,
      mentions: [],
    };
    expect(() => keywordEntities([orphan], { locale: "en" })).toThrow(
      "keyword page keywords/orphan has no mention to locate it",
    );
  });
});

describe("the build summary of the keyword publication", () => {
  it("counts the keyword pages generated and the expressions discarded by the threshold", () => {
    const result = publishKeywords([summary, cold, nightly], threshold);
    const counts = summarize({
      sources: 1,
      files: 3,
      findings: [],
      keywords: { published: result.published.length, discarded: result.discarded.length },
    });
    expect(counts.keywords).toEqual({ published: 1, discarded: 2 });
  });
});

describe.each(["en", "fr"])("the keyword pages of the minimal %s corpus", (locale) => {
  const corpus = readCorpus(locale);
  const pack = languagePack(locale);
  // Discovery keeps everything so that the publication threshold alone decides.
  const candidates = discover(corpus, { minOccurrences: 1, minDocuments: 1 });
  // Computed inside each test: a failure here must fail a test, not the collection of the file.
  const publish = (): PublishedKeywords =>
    publishKeywords(candidates, keywordPublicationOptions(corpus.config));

  it("publishes every expected expression with at least the expected counts", () => {
    const result = publish();
    for (const expectation of corpus.expected.published) {
      const page = result.published.find((p) => p.key === pack.normalize(expectation.text));
      expect(page, expectation.text).toBeDefined();
      expect(page?.occurrences).toBeGreaterThanOrEqual(expectation.min_occurrences ?? 0);
      expect(page?.documents).toBeGreaterThanOrEqual(expectation.min_files ?? 0);
      expect(page?.id).toBe(`keywords/${pack.normalize(expectation.text).replaceAll(" ", "-")}`);
    }
  });

  it("discards every unpublished expression while keeping it in the output", () => {
    const result = publish();
    const published = result.published.map((p) => p.key);
    const discarded = result.discarded.map((c) => c.key);
    for (const expectation of corpus.expected.unpublished) {
      const key = pack.normalize(expectation.text);
      expect(published, expectation.reason).not.toContain(key);
      expect(discarded, expectation.reason).toContain(key);
    }
  });

  it("publishes nothing more under the configured threshold than the discovery keeps", () => {
    const result = publish();
    const strict = discover(corpus)
      .map((c) => c.key)
      .sort();
    expect(result.published.map((p) => p.key).sort()).toEqual(strict);
    expect(result.published.length + result.discarded.length).toBe(candidates.length);
  });

  it("gives every page a valid entity located in the corpus", () => {
    const entities = keywordEntities(publish().published, { locale });
    expect(entities.length).toBeGreaterThan(0);
    for (const entity of entities) {
      expect(entity.id).toMatch(/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9._-]*)+$/);
      expect(entity.keyword).toBe(true);
      expect(corpus.config.sources.map((s) => s.name)).toContain(entity.source.name);
    }
  });
});
