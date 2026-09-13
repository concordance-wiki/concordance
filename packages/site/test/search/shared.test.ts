import { describe, expect, it } from "vitest";

import {
  CLEAR_CLASS,
  closestForm,
  FACET_NAMES,
  KEYWORD_TYPE,
  normalizeQuery,
  NOTELESS_FACET,
  NOTELESS_FILTERS,
  plural,
  queryWords,
  rank,
  shardFile,
  shardHref,
  shardOf,
  shardScript,
  trimEdges,
  type SearchEntry,
  type ShardData,
} from "../../src/search/shared.js";

describe("normalizeQuery", () => {
  it("folds case and accents, unifies the typographic apostrophes and collapses the whitespace, like a language pack", () => {
    expect(normalizeQuery("  L’Épreuve   du\tSeuil ")).toBe("l'epreuve du seuil");
    expect(normalizeQuery("Résumé ʼde build")).toBe("resume 'de build");
    expect(normalizeQuery("")).toBe("");
  });
});

describe("queryWords", () => {
  it("keeps the words of at least two characters, punctuation trimmed, once each and in order", () => {
    expect(queryWords("Keyword, page (keyword) a")).toEqual(["keyword", "page"]);
    expect(queryWords("build-summary")).toEqual(["build-summary"]);
    expect(queryWords("a . x")).toEqual([]);
  });

  it("trims the punctuation at both ends of a word and keeps the inside", () => {
    expect(trimEdges("(keyword-page)!")).toBe("keyword-page");
    expect(trimEdges("...")).toBe("");
  });
});

describe("shardOf and shardFile", () => {
  it("names the shard of a token after its first two characters, a two-character token being its own shard", () => {
    expect(shardOf("keyword")).toBe("ke");
    expect(shardOf("id")).toBe("id");
    expect(shardOf("ß-word")).toBe("ß-");
  });

  it("keeps letters and digits in the file name and writes every other character as its code point", () => {
    expect(shardFile("ke")).toBe("ke");
    expect(shardFile("2a")).toBe("2a");
    expect(shardFile("meta")).toBe("meta");
    expect(shardFile("ß-")).toBe("_00df_002d");
    expect(shardFile("l'")).toBe("l_0027");
    expect(shardHref("../search/", "l'")).toBe("../search/l_0027.js");
  });

  it("wraps the JSON of a file in a classic script calling the global with the name of the file", () => {
    expect(shardScript("ke", '{"keyword":[[1,5]]}')).toBe(
      'window.__concordanceSearch.shard("ke",{"keyword":[[1,5]]});\n',
    );
  });
});

describe("rank", () => {
  const shards = new Map<string, ShardData>([
    [
      "ke",
      {
        keyword: [
          [1, 5],
          [3, 1],
        ],
        keywords: [[2, 4]],
        kept: [[1, 1]],
      },
    ],
    [
      "pa",
      {
        page: [
          [1, 10],
          [2, 5],
        ],
        panel: [[4, 5]],
      },
    ],
  ]);

  it("matches a word as a prefix of the tokens of its shard and counts the heaviest token per entity", () => {
    expect(rank(["key"], shards)).toEqual([
      { entity: 1, score: 5 },
      { entity: 2, score: 4 },
      { entity: 3, score: 1 },
    ]);
    expect(rank(["ke"], shards)).toEqual([
      { entity: 1, score: 5 },
      { entity: 2, score: 4 },
      { entity: 3, score: 1 },
    ]);
  });

  it("keeps the entities matching every word and sums their weights, ties in table order", () => {
    expect(rank(["key", "pa"], shards)).toEqual([
      { entity: 1, score: 15 },
      { entity: 2, score: 9 },
    ]);
    expect(rank(["pa", "key"], shards)).toEqual([
      { entity: 1, score: 15 },
      { entity: 2, score: 9 },
    ]);
    expect(rank(["panel", "key"], shards)).toEqual([]);
  });

  it("never puts a keyword page before an entity of the same score, the table order deciding otherwise", () => {
    const keyword = (entity: number): boolean => entity === 1;
    expect(rank(["key"], shards, { keyword })).toEqual([
      { entity: 1, score: 5 },
      { entity: 2, score: 4 },
      { entity: 3, score: 1 },
    ]);
    const tied = new Map<string, ShardData>([
      [
        "ke",
        {
          keyword: [
            [1, 5],
            [2, 5],
            [3, 5],
          ],
        },
      ],
    ]);
    expect(rank(["ke"], tied, { keyword })).toEqual([
      { entity: 2, score: 5 },
      { entity: 3, score: 5 },
      { entity: 1, score: 5 },
    ]);
    expect(rank(["ke"], tied, { keyword: (entity) => entity !== 1 })).toEqual([
      { entity: 1, score: 5 },
      { entity: 2, score: 5 },
      { entity: 3, score: 5 },
    ]);
    expect(rank(["ke"], tied)).toEqual([
      { entity: 1, score: 5 },
      { entity: 2, score: 5 },
      { entity: 3, score: 5 },
    ]);
  });

  it("puts the most cited first among entities of the same score, the keyword pages still after them, and the score before the citations", () => {
    const tied = new Map<string, ShardData>([
      [
        "ke",
        {
          keyword: [
            [1, 5],
            [2, 5],
            [3, 5],
          ],
          keywords: [[4, 6]],
        },
      ],
    ]);
    const cited = (entity: number): number => ({ 1: 2, 2: 9, 3: 4 })[entity] ?? 0;
    expect(rank(["ke"], tied, { cited })).toEqual([
      { entity: 4, score: 6 },
      { entity: 2, score: 5 },
      { entity: 3, score: 5 },
      { entity: 1, score: 5 },
    ]);
    expect(rank(["ke"], tied, { cited, keyword: (entity) => entity === 2 })).toEqual([
      { entity: 4, score: 6 },
      { entity: 3, score: 5 },
      { entity: 1, score: 5 },
      { entity: 2, score: 5 },
    ]);
    expect(KEYWORD_TYPE).toBe("keyword");
    expect(CLEAR_CLASS).toBe("search-clear");
  });

  it("matches nothing without a word, for a word without a shard, and without typo correction", () => {
    expect(rank([], shards)).toEqual([]);
    expect(rank(["zz"], shards)).toEqual([]);
    expect(rank(["keywrod"], shards)).toEqual([]);
    expect(rank(["eyword"], shards)).toEqual([]);
  });
});

describe("plural", () => {
  it("picks the text of the plural category of the count in the locale and writes the number in it", () => {
    const forms = { one: "# result", other: "# results" };
    expect(plural(forms, 1, "en")).toBe("1 result");
    expect(plural(forms, 0, "en")).toBe("0 results");
    expect(plural(forms, 1234, "en")).toBe("1,234 results");
    expect(
      plural({ one: "# résultat", many: "# résultats (many)", other: "# résultats" }, 1, "fr"),
    ).toBe("1 résultat");
    expect(plural({ one: "# résultat", other: "# résultats" }, 0, "fr")).toBe("0 résultat");
  });

  it("falls back on the other form for a category the forms lack, and on nothing at all without it", () => {
    expect(plural({ other: "# results" }, 1, "en")).toBe("1 results");
    expect(plural({}, 2, "en")).toBe("");
    expect(FACET_NAMES).toEqual(["type", "source", "domain", "application"]);
    expect(NOTELESS_FACET).toBe("nonote");
    expect(NOTELESS_FILTERS).toEqual(["any", "only", "exclude"]);
  });
});

describe("closestForm", () => {
  const entry = (title: string, aliases?: string[]): SearchEntry => ({
    id: title,
    title,
    type: "term",
    url: `${title}/index.html`,
    status: "active",
    source: "glossary",
    ...(aliases === undefined ? {} : { aliases }),
  });
  const entries = [
    entry("Publication threshold", ["threshold"]),
    entry("Threshold review"),
    entry("Keyword page", ["word page"]),
    entry("Plafond de versement"),
    entry("Plafond"),
  ];

  it("proposes the title or alias sharing the longest prefix with the query, case and accents folded", () => {
    expect(closestForm("thresold", entries)).toEqual({ entity: 0, form: "threshold" });
    expect(closestForm("Thresh", entries)).toEqual({ entity: 0, form: "threshold" });
    expect(closestForm("wor", entries)).toEqual({ entity: 2, form: "word page" });
    expect(closestForm("KEYW", entries)).toEqual({ entity: 2, form: "Keyword page" });
  });

  it("prefers the shortest form among equal prefixes, so that a word beats the expressions starting with it", () => {
    expect(closestForm("plafon", entries)).toEqual({ entity: 4, form: "Plafond" });
    expect(closestForm("plafond de", entries)).toEqual({ entity: 3, form: "Plafond de versement" });
  });

  it("proposes nothing under two characters in common, or over an empty table", () => {
    expect(closestForm("zebra", entries)).toBeUndefined();
    expect(closestForm("p", entries)).toBeUndefined();
    expect(closestForm("", entries)).toBeUndefined();
    expect(closestForm("threshold", [])).toBeUndefined();
  });
});
