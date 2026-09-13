import { describe, expect, it } from "vitest";

import {
  compareMentions,
  extractNgrams,
  languagePack,
  scoreCandidates,
  type KeywordCandidate,
  type KeywordUnit,
  type NgramOccurrence,
  type ScoreCandidatesOptions,
} from "../../src/index.js";

const pack = languagePack("en");
const defaults: ScoreCandidatesOptions = {
  pack,
  dictionaryKeys: new Set(),
  rejected: new Set(),
  minOccurrences: 3,
  minDocuments: 2,
};

function unit(path: string, text: string, line = 1, source?: string): KeywordUnit {
  return { ...(source === undefined ? {} : { source }), path, line, text };
}

function candidates(
  units: KeywordUnit[],
  options: Partial<ScoreCandidatesOptions> = {},
  maxWords = 4,
): KeywordCandidate[] {
  const occurrences = extractNgrams(units, pack, { maxWords, minLength: 3 });
  return scoreCandidates(occurrences, { ...defaults, ...options });
}

function summary(list: KeywordCandidate[]): [string, number, number, number][] {
  return list.map((c) => [c.key, c.occurrences, c.documents, c.score]);
}

describe("scoreCandidates", () => {
  it("ranks by C-value multiplied by IDF", () => {
    // "glossary owner" twice in two files: C-value log2(3) × 2 = 3.1699, IDF ln(1 + 2/2) = 0.6931.
    const units = [unit("a.md", "glossary owner validates"), unit("b.md", "glossary owner")];
    const thresholds = { minOccurrences: 2, minDocuments: 2 };
    expect(summary(candidates(units, thresholds, 2))).toEqual([
      ["glossary owner", 2, 2, 2.1972],
      ["glossary", 2, 2, 0],
      ["owner", 2, 2, 0],
    ]);
  });

  it("weighs the frequency by the logarithm of the length and the rarity across files", () => {
    // "cap" three times in three files, explained twice by "related cap": 1 × (3 − 2) × ln(1 + 3/3).
    // "related cap" twice in two files: log2(3) × 2 × ln(1 + 3/2) = 2.9046.
    const units = [unit("a.md", "related cap"), unit("b.md", "related cap"), unit("c.md", "cap")];
    const thresholds = { minOccurrences: 1, minDocuments: 1 };
    expect(summary(candidates(units, thresholds, 2))).toEqual([
      ["related cap", 2, 2, 2.9046],
      ["cap", 3, 3, 0.6931],
      ["related", 2, 2, 0],
    ]);
  });

  it("penalises an n-gram contained in a longer, more frequent one", () => {
    const units = [
      unit("a.md", "cap checked server"),
      unit("b.md", "cap checked server"),
      unit("c.md", "cap checked server"),
    ];
    // The trigram keeps log2(4) × 3 × ln 2; the bigrams and unigrams it explains fall to zero.
    expect(summary(candidates(units))).toEqual([
      ["cap checked server", 3, 3, 4.1589],
      ["cap", 3, 3, 0],
      ["cap checked", 3, 3, 0],
      ["checked", 3, 3, 0],
      ["checked server", 3, 3, 0],
      ["server", 3, 3, 0],
    ]);
  });

  it("subtracts the mean frequency of the longer n-grams, not their sum", () => {
    const units = [
      unit("a.md", "cap checked"),
      unit("a.md", "cap checked", 2),
      unit("b.md", "cap checked"),
      unit("b.md", "cap limit", 2),
      unit("c.md", "cap limit"),
      unit("c.md", "cap limit", 2),
      unit("d.md", "cap"),
    ];
    // "cap" seven times in four files, explained by "cap checked" (3) and "cap limit" (3):
    // 1 × (7 − 3) × ln(1 + 4/4) = 2.7726. Each bigram: log2(3) × 3 × ln(1 + 4/2) = 5.2238.
    expect(summary(candidates(units))).toEqual([
      ["cap checked", 3, 2, 5.2238],
      ["cap limit", 3, 2, 5.2238],
      ["cap", 7, 4, 2.7726],
      ["checked", 3, 2, 0],
      ["limit", 3, 2, 0],
    ]);
  });

  it("lets an n-gram with inner stopwords explain its edge words", () => {
    const units = [
      unit("a.md", "cap of the build"),
      unit("b.md", "cap of the build"),
      unit("c.md", "cap of the build"),
    ];
    // log2(5) × 3 × ln 2 for the whole expression; the inner stopwords are no candidates.
    expect(summary(candidates(units))).toEqual([
      ["cap of the build", 3, 3, 4.8283],
      ["build", 3, 3, 0],
      ["cap", 3, 3, 0],
    ]);
  });

  it("lets a rare longer n-gram explain nothing", () => {
    const units = [
      unit("a.md", "related cap checked server"),
      unit("b.md", "cap checked server"),
      unit("c.md", "cap checked server"),
    ];
    const scored = candidates(units);
    expect(scored.map((c) => c.key)).not.toContain("related cap checked server");
    expect(summary(scored)[0]).toEqual(["cap checked server", 3, 3, 4.1589]);
  });

  it("keeps three occurrences in two distinct documents by default", () => {
    const units = [
      unit("a.md", "pipeline runs nightly"),
      unit("a.md", "pipeline failed", 2),
      unit("a.md", "pipeline", 3),
      unit("b.md", "nightly batch"),
      unit("b.md", "nightly", 2),
      unit("c.md", "nightly"),
    ];
    // "pipeline" has three occurrences in one file; "nightly" four in three; "batch" one.
    expect(summary(candidates(units))).toEqual([["nightly", 4, 3, 2.7726]]);
    expect(summary(candidates(units, { minDocuments: 1 })).map(([key]) => key)).toEqual([
      "pipeline",
      "nightly",
    ]);
    expect(summary(candidates(units, { minOccurrences: 5 }))).toEqual([]);
  });

  it("counts the same path in two sources as two documents", () => {
    const units = [
      unit("index.md", "nightly batch", 1, "specs"),
      unit("index.md", "nightly batch", 1, "decisions"),
      unit("index.md", "nightly batch", 2, "decisions"),
    ];
    expect(summary(candidates(units))).toEqual([
      ["nightly batch", 3, 2, 3.2958],
      ["batch", 3, 2, 0],
      ["nightly", 3, 2, 0],
    ]);
    const unsourced = units.map(({ path, line, text }) => ({ path, line, text }));
    expect(summary(candidates(unsourced))).toEqual([]);
    const [top] = candidates(unsourced, { minDocuments: 1 });
    expect(top?.mentions[0]).toStrictEqual({
      path: "index.md",
      line: 1,
      position: 0,
      surface: "nightly batch",
      context: "nightly batch",
    });
  });

  it("excludes n-grams already in the dictionary and those listed in the lock's rejected terms", () => {
    const units = [
      unit("a.md", "Build summaries after the cold-start"),
      unit("b.md", "build summary after the cold start"),
      unit("c.md", "build summary cold start"),
    ];
    const scored = candidates(units, {
      dictionaryKeys: new Set(["cold-start"]),
      rejected: new Set(["Build Summaries"]),
    });
    expect(summary(scored)).toEqual([
      ["build", 3, 3, 0],
      ["cold", 3, 3, 0],
      ["start", 3, 3, 0],
      ["summary", 3, 3, 0],
    ]);
  });

  it("carries the score, the occurrences and their contexts for each candidate", () => {
    const units = [
      unit("b.md", "the related cap", 1, "specs"),
      unit("a.md", "Related cap set in the profile", 3, "specs"),
      unit("a.md", "Related cap", 1, "glossary"),
    ];
    const [candidate] = candidates(units, { minOccurrences: 1, minDocuments: 1 }, 2);
    expect(candidate).toEqual({
      key: "related cap",
      display: "Related cap",
      words: 2,
      occurrences: 3,
      documents: 3,
      score: 3.2958,
      mentions: [
        {
          source: "glossary",
          path: "a.md",
          line: 1,
          position: 0,
          surface: "Related cap",
          context: "Related cap",
        },
        {
          source: "specs",
          path: "a.md",
          line: 3,
          position: 0,
          surface: "Related cap",
          context: "Related cap set in the profile",
        },
        {
          source: "specs",
          path: "b.md",
          line: 1,
          position: 4,
          surface: "related cap",
          context: "the related cap",
        },
      ],
    });
  });

  it("displays the most frequent surface form, the first mention deciding a tie", () => {
    const units = [
      unit("b.md", "related cap"),
      unit("a.md", "Related Cap", 2),
      unit("a.md", "RELATED CAP", 1),
      unit("c.md", "RELATED CAP"),
    ];
    const [tied] = candidates(units.slice(0, 3), { minOccurrences: 1, minDocuments: 1 }, 2);
    expect(tied?.display).toBe("RELATED CAP");
    const [frequent] = candidates(
      [...units, unit("d.md", "Related Cap"), unit("e.md", "Related Cap")],
      {
        minOccurrences: 1,
        minDocuments: 1,
      },
      2,
    );
    expect(frequent?.display).toBe("Related Cap");
  });

  it("sorts candidates by score, then by key", () => {
    const units = [
      unit("a.md", "beta alpha"),
      unit("b.md", "beta alpha"),
      unit("c.md", "beta"),
      unit("c.md", "alpha", 2),
    ];
    const scored = candidates(units, { minOccurrences: 1, minDocuments: 1 }, 2);
    expect(summary(scored)).toEqual([
      ["beta alpha", 2, 2, 2.9046],
      ["alpha", 3, 3, 0.6931],
      ["beta", 3, 3, 0.6931],
    ]);
  });
});

describe("compareMentions", () => {
  it("orders by source, path, line, then position", () => {
    const mention = (
      source: string | undefined,
      path: string,
      line: number,
      position: number,
    ): Pick<NgramOccurrence, "source" | "path" | "line" | "position"> => ({
      ...(source === undefined ? {} : { source }),
      path,
      line,
      position,
    });
    const unsorted = [
      mention("specs", "a.md", 1, 5),
      mention("specs", "a.md", 1, 2),
      mention("specs", "a.md", 0, 9),
      mention("Archive", "z.md", 4, 0),
      mention(undefined, "z.md", 4, 0),
      mention("specs", "b.md", 0, 0),
    ];
    expect([...unsorted].sort(compareMentions)).toEqual([
      mention(undefined, "z.md", 4, 0),
      mention("Archive", "z.md", 4, 0),
      mention("specs", "a.md", 0, 9),
      mention("specs", "a.md", 1, 2),
      mention("specs", "a.md", 1, 5),
      mention("specs", "b.md", 0, 0),
    ]);
  });
});
