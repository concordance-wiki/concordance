import { describe, expect, it, vi } from "vitest";

import {
  extractNgrams,
  languagePack,
  ngramContext,
  ngramSurface,
  scoreCandidates,
  type KeywordUnit,
} from "../../src/index.js";

/**
 * The discovery reads a corpus twice and this run is instrumented, so it is several times slower
 * than a build. The timeout is the one of a loaded runner, not of the work: the test asserts
 * quantities, never a duration, and a machine running the whole suite in parallel has been seen
 * taking minutes over what takes a second on an idle one.
 */
vi.setConfig({ testTimeout: 600_000 });

const UNITS = 120;
const WORDS_PER_UNIT = 400;
const vocabulary = [
  "build",
  "summary",
  "cap",
  "nightly",
  "glossary",
  "owner",
  "batch",
  "screen",
  "link",
  "domain",
  "note",
  "source",
  "term",
  "page",
  "wiki",
];

/** A generator with a seed: the corpus is the same on every machine and in every run. */
function generator(seed: number): () => number {
  let value = seed % 2_147_483_647;
  return () => {
    value = (value * 48_271) % 2_147_483_647;
    return value / 2_147_483_647;
  };
}

function corpus(): KeywordUnit[] {
  const next = generator(7);
  return Array.from({ length: UNITS }, (unused, index) => ({
    path: `notes/${String(index)}.md`,
    line: 1,
    text: Array.from(
      { length: WORDS_PER_UNIT },
      () => vocabulary[Math.floor(next() * vocabulary.length)] ?? "build",
    ).join(" "),
  }));
}

describe("the keyword discovery on a large corpus", () => {
  it("extracts the n-grams of 120 notes of 400 words without materialising a surface", () => {
    const units = corpus();
    const started = performance.now();
    const ngrams = extractNgrams(units, languagePack("en"), { maxWords: 4, minLength: 3 });
    const extracted = performance.now() - started;
    const scoreStarted = performance.now();
    const candidates = scoreCandidates(ngrams, {
      pack: languagePack("en"),
      dictionaryKeys: new Set(),
      rejected: new Set(),
      minOccurrences: 5,
      minDocuments: 3,
    });
    const scored = performance.now() - scoreStarted;
    process.stdout.write(
      `keywords: ${String(ngrams.length)} n-grams in ${extracted.toFixed(0)} ms, ${String(candidates.length)} candidates in ${scored.toFixed(0)} ms\n`,
    );

    // Deterministic quantities: the corpus, the extraction and the thresholds decide them, never
    // the machine. A change of any of the three is a change of these numbers, to be read and meant.
    expect(ngrams).toHaveLength(191_280);
    expect(candidates).toHaveLength(3735);

    // The point of the two passes: an occurrence carries where it was met, not what it looked like.
    // The strings are cut from the unit for the candidates alone, which are a fraction of the whole.
    const [first] = ngrams;
    expect(first && Object.keys(first).sort()).toEqual([
      "end",
      "key",
      "line",
      "path",
      "position",
      "unit",
    ]);
    expect(first && ngramSurface(first)).toBe("build");
    expect(first && ngramContext(first)).toMatch(/^build /u);
    expect(candidates[0]?.mentions[0]?.context.length).toBeGreaterThan(0);
  });
});
