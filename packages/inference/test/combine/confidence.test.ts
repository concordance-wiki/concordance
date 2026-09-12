import { describe, expect, it } from "vitest";

import { combineConfidences, glossaryConfidence } from "../../src/combine/confidence.js";
import { generator } from "../neighbourhood/fixtures.js";

const glossary = { bonus: 0.05, cap: 0.8 };

function randomValues(next: () => number, length: number): number[] {
  return Array.from({ length }, () => Math.round(next() * 100) / 100);
}

describe("the combination of confidences", () => {
  it("retains 1 − Π(1 − cᵢ) when two methods yield the same triple: 0.9 and 0.6 give 0.96", () => {
    expect(combineConfidences([0.9, 0.6])).toBe(0.96);
  });

  it("caps three methods 1.0, 0.7 and 0.4 at 1", () => {
    expect(combineConfidences([1, 0.7, 0.4])).toBe(1);
  });

  it("combines three methods below the cap: 0.7, 0.6 and 0.4 give 0.928", () => {
    expect(combineConfidences([0.7, 0.6, 0.4])).toBe(0.928);
  });

  it("is the identity on a single value", () => {
    expect(combineConfidences([0.4])).toBe(0.4);
    expect(combineConfidences([0.9])).toBe(0.9);
  });

  it("gives no confidence to no method", () => {
    expect(combineConfidences([])).toBe(0);
  });

  it("rounds to four decimals so that the serialised number is stable", () => {
    expect(combineConfidences([0.7, 0.7])).toBe(0.91);
    expect(combineConfidences([0.123_456, 0.5])).toBe(0.5617);
  });

  it("clamps a value outside [0, 1] back into the bounds", () => {
    expect(combineConfidences([1.5])).toBe(1);
    expect(combineConfidences([-0.5])).toBe(0);
    expect(combineConfidences([0.5, -0.5])).toBe(0.25);
  });

  it("stays within [0, 1] on seeded random arrays", () => {
    const next = generator(7);
    for (let round = 0; round < 200; round += 1) {
      const combined = combineConfidences(randomValues(next, 1 + Math.floor(next() * 6)));
      expect(combined).toBeGreaterThanOrEqual(0);
      expect(combined).toBeLessThanOrEqual(1);
      expect(combined).toBe(Math.round(combined * 10_000) / 10_000);
    }
  });

  it("is commutative: any permutation of the values gives the same confidence", () => {
    const next = generator(13);
    for (let round = 0; round < 200; round += 1) {
      const values = randomValues(next, 2 + Math.floor(next() * 5));
      const shuffled = [...values].sort(() => next() - 0.5);
      expect(combineConfidences(shuffled)).toBe(combineConfidences(values));
      expect(combineConfidences([...values].reverse())).toBe(combineConfidences(values));
    }
  });

  it("is associative: combining a combination with the rest gives the same confidence", () => {
    const next = generator(29);
    for (let round = 0; round < 200; round += 1) {
      const values = randomValues(next, 3);
      const [a, b, c] = values;
      const whole = combineConfidences(values);
      expect(combineConfidences([combineConfidences([a ?? 0, b ?? 0]), c ?? 0])).toBeCloseTo(
        whole,
        3,
      );
      expect(combineConfidences([a ?? 0, combineConfidences([b ?? 0, c ?? 0])])).toBeCloseTo(
        whole,
        3,
      );
    }
  });

  it("never falls below the strongest method", () => {
    const next = generator(31);
    for (let round = 0; round < 200; round += 1) {
      const values = randomValues(next, 1 + Math.floor(next() * 6));
      expect(combineConfidences(values)).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });
});

describe("the glossary occurrence confidence", () => {
  it("is the base for a single occurrence: 0.6", () => {
    expect(glossaryConfidence(0.6, 1, glossary)).toBe(0.6);
  });

  it("adds 0.05 per additional occurrence: three occurrences give 0.7", () => {
    expect(glossaryConfidence(0.6, 2, glossary)).toBe(0.65);
    expect(glossaryConfidence(0.6, 3, glossary)).toBe(0.7);
    expect(glossaryConfidence(0.6, 4, glossary)).toBe(0.75);
  });

  it("caps five occurrences at 0.80", () => {
    expect(glossaryConfidence(0.6, 5, glossary)).toBe(0.8);
    expect(glossaryConfidence(0.6, 6, glossary)).toBe(0.8);
    expect(glossaryConfidence(0.6, 50, glossary)).toBe(0.8);
  });

  it("reads the bonus and the cap from the options", () => {
    expect(glossaryConfidence(0.5, 3, { bonus: 0.1, cap: 0.9 })).toBe(0.7);
    expect(glossaryConfidence(0.5, 3, { bonus: 0.1, cap: 0.65 })).toBe(0.65);
  });

  it("keeps a base above the cap at the cap", () => {
    expect(glossaryConfidence(0.9, 1, glossary)).toBe(0.8);
  });
});
