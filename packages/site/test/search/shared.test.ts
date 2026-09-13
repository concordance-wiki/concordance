import { describe, expect, it } from "vitest";

import {
  normalizeQuery,
  queryWords,
  rank,
  shardFile,
  shardHref,
  shardOf,
  shardScript,
  trimEdges,
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

  it("matches nothing without a word, for a word without a shard, and without typo correction", () => {
    expect(rank([], shards)).toEqual([]);
    expect(rank(["zz"], shards)).toEqual([]);
    expect(rank(["keywrod"], shards)).toEqual([]);
    expect(rank(["eyword"], shards)).toEqual([]);
  });
});
