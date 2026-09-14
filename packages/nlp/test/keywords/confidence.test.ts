import { describe, expect, it } from "vitest";

import {
  BURST_MIN_FILES,
  BURST_PER_FILE,
  confidenceDefaults,
  confidenceFactors,
  confidenceOf,
  confidencePenalties,
  extractNgrams,
  languagePack,
  MORPHOLOGY_PENALTY,
  NEIGHBOURHOOD_BASE,
  POSITION_BASE,
  scoreCandidates,
  SPREAD_MIN_FILES,
  type ConfidenceInput,
  type KeywordCandidate,
  type KeywordUnit,
  type ScoreCandidatesOptions,
} from "../../src/index.js";

const pack = languagePack("en");

/** A term of the subject as the corpus treats it: concentrated, recurring, never inflected. */
const term: ConfidenceInput = {
  spread: 0.2,
  burst: 3,
  prominence: 0,
  neighbour: false,
  inflected: false,
  corpus: 30,
  files: 6,
};

describe("confidenceFactors", () => {
  it("names the constants of the formula", () => {
    expect([SPREAD_MIN_FILES, BURST_MIN_FILES, BURST_PER_FILE]).toEqual([10, 5, 1.5]);
    expect([POSITION_BASE, NEIGHBOURHOOD_BASE, MORPHOLOGY_PENALTY]).toEqual([0.8, 0.9, 0.8]);
    expect(confidenceDefaults).toEqual({ maxSpread: 0.5 });
  });

  it("gives a plain term every factor at its base: one, one, the position and neighbourhood bases, one", () => {
    expect(confidenceFactors(term)).toEqual({
      spread: 1,
      burst: 1,
      position: 0.8,
      neighbourhood: 0.9,
      morphology: 1,
    });
  });

  it("lets the spread fall linearly from one at max_spread to zero in every file", () => {
    expect(confidenceFactors({ ...term, spread: 0.5 }).spread).toBe(1);
    expect(confidenceFactors({ ...term, spread: 0.75 }).spread).toBe(0.5);
    expect(confidenceFactors({ ...term, spread: 1 }).spread).toBe(0);
    expect(confidenceFactors({ ...term, spread: 0.6 }, { maxSpread: 0.2 }).spread).toBe(0.5);
  });

  it("reads the spread only in a corpus of ten files", () => {
    expect(confidenceFactors({ ...term, spread: 1, corpus: 9, files: 9 }).spread).toBe(1);
    expect(confidenceFactors({ ...term, spread: 1, corpus: 10, files: 10 }).spread).toBe(0);
  });

  it("reads the burst only from five files, rising from one half at once per file to one at 1.5", () => {
    expect(confidenceFactors({ ...term, burst: 1, files: 4 }).burst).toBe(1);
    expect(confidenceFactors({ ...term, burst: 1, files: 5 }).burst).toBe(0.5);
    expect(confidenceFactors({ ...term, burst: 1.25, files: 5 }).burst).toBe(0.75);
    expect(confidenceFactors({ ...term, burst: 1.5, files: 5 }).burst).toBe(1);
    expect(confidenceFactors({ ...term, burst: 4, files: 40 }).burst).toBe(1);
  });

  it("adds the prominence share of the rest to the position base", () => {
    expect(confidenceFactors({ ...term, prominence: 0.5 }).position).toBe(0.9);
    expect(confidenceFactors({ ...term, prominence: 1 }).position).toBe(1);
  });

  it("gives the neighbourhood bonus to an expression a defined term accompanies", () => {
    expect(confidenceFactors({ ...term, neighbour: true }).neighbourhood).toBe(1);
  });

  it("penalises an inflected form softly", () => {
    expect(confidenceFactors({ ...term, inflected: true }).morphology).toBe(0.8);
  });
});

describe("confidenceOf", () => {
  it("multiplies the five factors and rounds to four decimals", () => {
    expect(confidenceOf(term)).toBe(0.72);
    // 0.6666 × 0.7 × 0.8 × 0.9 × 0.8
    expect(confidenceOf({ ...term, spread: 0.6667, burst: 1.2, files: 5, inflected: true })).toBe(
      0.2688,
    );
    expect(confidenceOf({ ...term, prominence: 1, neighbour: true })).toBe(1);
    expect(confidenceOf({ ...term, spread: 1 })).toBe(0);
  });

  it("reads max_spread from its options", () => {
    expect(confidenceOf({ ...term, spread: 0.4 }, { maxSpread: 0.2 })).toBe(0.54);
  });
});

describe("confidencePenalties", () => {
  it("lists the signals that lowered the confidence, in the order of the formula, bonuses aside", () => {
    expect(confidencePenalties(term)).toEqual([]);
    expect(
      confidencePenalties({ ...term, spread: 0.7, burst: 1.1, files: 9, inflected: true }),
    ).toEqual(["spread", "burst", "morphology"]);
    expect(confidencePenalties({ ...term, burst: 1.1, files: 4 })).toEqual([]);
    expect(confidencePenalties({ ...term, inflected: true }, { maxSpread: 0.1 })).toEqual([
      "spread",
      "morphology",
    ]);
  });
});

/**
 * A corpus about Concordance itself: ten notes, each a few sentences, in which one word is
 * flat everywhere, one recurs once per file, one is put forward in headings, one accompanies
 * a defined term and one is an inflected form.
 */
function unit(path: string, text: string, line = 1): KeywordUnit {
  return { source: "notes", path, line, text };
}

const notes = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((name) => `${name}.md`);

const corpus: KeywordUnit[] = [
  // "overall" once in every note: a word of the language.
  ...notes.map((path) => unit(path, "Overall the note is filed.")),
  // "rebuild" once in five notes: never treated, mentioned in passing.
  ...notes.slice(0, 5).map((path) => unit(path, "A rebuild follows.", 2)),
  // "checker" treated in two notes, twice each, and put forward in two headings.
  ...notes
    .slice(0, 2)
    .flatMap((path) => [unit(path, "The checker reads the model; the checker reports.", 3)]),
  // "summary" as the part of "build summary" that "build", a defined term, vouches for.
  ...notes.slice(2, 5).map((path) => unit(path, "The build summary counts pages.", 4)),
  // "rendering" in three notes, twice each: an inflected form.
  ...notes.slice(5, 8).map((path) => unit(path, "Rendering starts; rendering ends.", 5)),
];

const headings = [unit("a.md", "Checker", 0), unit("b.md", "The checker", 0)];

const extract = (units: KeywordUnit[]) =>
  extractNgrams(units, pack, { maxWords: 2, minLength: 3, stopwords: new Set(["the", "a"]) });

function discover(options: Partial<ScoreCandidatesOptions> = {}): Map<string, KeywordCandidate> {
  const candidates = scoreCandidates(extract(corpus), {
    pack,
    dictionaryKeys: new Set(["build"]),
    rejected: new Set(),
    minOccurrences: 3,
    minDocuments: 2,
    prominent: extract(headings),
    ...options,
  });
  return new Map(candidates.map((candidate) => [candidate.key, candidate]));
}

/** The discovery without any prominent text given: the option left out, not emptied. */
function discoverPlain(): Map<string, KeywordCandidate> {
  const candidates = scoreCandidates(extract(corpus), {
    pack,
    dictionaryKeys: new Set(["build"]),
    rejected: new Set(),
    minOccurrences: 3,
    minDocuments: 2,
  });
  return new Map(candidates.map((candidate) => [candidate.key, candidate]));
}

describe("the confidence of a candidate, read from its distribution in the corpus", () => {
  const found = discover();

  it("gives a flat word present in every file no confidence at all", () => {
    const overall = found.get("overall");
    expect(overall?.signals).toEqual({
      spread: 1,
      burst: 1,
      prominence: 0,
      neighbour: false,
      inflected: false,
    });
    expect(overall?.confidence).toBe(0);
    expect(overall?.confidence).toBeLessThan(0.3);
    expect(overall?.penalties).toEqual(["spread", "burst"]);
  });

  it("halves the burst of a word mentioned once in each of five files", () => {
    const rebuild = found.get("rebuild");
    expect(rebuild?.signals).toEqual({
      spread: 0.5,
      burst: 1,
      prominence: 0,
      neighbour: false,
      inflected: false,
    });
    expect(rebuild?.confidence).toBe(0.36);
    expect(rebuild?.penalties).toEqual(["burst"]);
  });

  it("gives a concentrated, bursty, heading-borne term a high confidence", () => {
    const checker = found.get("checker");
    expect(checker?.signals).toEqual({
      spread: 0.2,
      burst: 2,
      prominence: 0.5,
      neighbour: false,
      inflected: false,
    });
    expect(checker?.confidence).toBe(0.81);
    expect(checker?.confidence).toBeGreaterThan(0.8);
    expect(checker?.penalties).toEqual([]);
  });

  it("caps the prominence at one appearance per occurrence", () => {
    const prominent = extract([...headings, ...headings, unit("c.md", "checker, checker.", 0)]);
    expect(discover({ prominent }).get("checker")?.signals.prominence).toBe(1);
    expect(discover({ prominent }).get("checker")?.confidence).toBe(0.9);
  });

  it("vouches for the parts of a frequent n-gram that holds a defined term, and for the n-gram", () => {
    expect(found.get("summary")?.signals.neighbour).toBe(true);
    expect(found.get("summary")?.confidence).toBe(0.8);
    expect(found.get("build summary")?.signals.neighbour).toBe(true);
    expect(found.get("build")).toBeUndefined();
    expect(found.get("rebuild")?.signals.neighbour).toBe(false);
  });

  it("vouches for nothing when the n-gram holding the defined term is rare", () => {
    const rare = discover({ minOccurrences: 4 });
    expect(rare.get("summary")).toBeUndefined();
    const parts = discover({ dictionaryKeys: new Set(["model"]) });
    expect(parts.get("summary")?.signals.neighbour).toBe(false);
  });

  it("penalises an inflected form softly, naming the morphology", () => {
    const rendering = found.get("rendering");
    expect(rendering?.signals).toEqual({
      spread: 0.3,
      burst: 2,
      prominence: 0,
      neighbour: false,
      inflected: true,
    });
    expect(rendering?.confidence).toBe(0.576);
    expect(rendering?.penalties).toEqual(["morphology"]);
  });

  it("reads no inflection from a word that is a suffix alone, nor from a pack without suffixes", () => {
    const short = discover({ pack: { ...pack, suffixes: new Set(["rendering"]) } });
    expect(short.get("rendering")?.signals.inflected).toBe(false);
    const bare = discover({ pack: { ...pack, suffixes: new Set() } });
    expect(bare.get("rendering")?.signals.inflected).toBe(false);
  });

  it("reads max_spread from the options and defaults it to one half", () => {
    expect(discover({ maxSpread: 0.25 }).get("rebuild")?.confidence).toBe(0.24);
    expect(discover({ maxSpread: 0.25 }).get("rebuild")?.penalties).toEqual(["spread", "burst"]);
    expect(discoverPlain().get("checker")?.confidence).toBe(0.72);
    expect(discoverPlain().get("checker")?.signals.prominence).toBe(0);
  });

  it("gives the same values from one run to the next", () => {
    const again = discover();
    for (const [key, candidate] of found) {
      expect(again.get(key)?.confidence).toBe(candidate.confidence);
      expect(again.get(key)?.signals).toEqual(candidate.signals);
    }
  });
});
