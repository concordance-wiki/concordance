import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { combineConfidences, glossaryConfidence } from "../src/combine/confidence.js";

/** Generated cases, with a seed: the case a failure names is the same on every machine. */
const RUNS = { numRuns: 300, seed: 20_260_929 } as const;
/** A confidence as the model carries it: in [0, 1], rounded to four decimals. */
const confidence = () =>
  fc.integer({ min: 0, max: 10_000 }).map((value) => Math.round(value) / 10_000);

describe("combineConfidences", () => {
  it("stays in [0, 1] and is never below the best of what it combines", () => {
    fc.assert(
      fc.property(fc.array(confidence(), { maxLength: 8 }), (values) => {
        const combined = combineConfidences(values);
        expect(combined).toBeGreaterThanOrEqual(0);
        expect(combined).toBeLessThanOrEqual(1);
        // Rounding to four decimals is the only thing between the combination and each value.
        expect(combined).toBeGreaterThanOrEqual(Math.max(0, ...values) - 0.0001);
      }),
      RUNS,
    );
  });

  it("does not depend on the order of what it combines", () => {
    fc.assert(
      fc.property(fc.array(confidence(), { maxLength: 8 }), (values) => {
        expect(combineConfidences([...values].reverse())).toBe(combineConfidences(values));
      }),
      RUNS,
    );
  });

  it("reads a certainty as a certainty, and nothing as no confidence at all", () => {
    fc.assert(
      fc.property(fc.array(confidence(), { maxLength: 8 }), (values) => {
        expect(combineConfidences([...values, 1])).toBe(1);
      }),
      RUNS,
    );
    expect(combineConfidences([])).toBe(0);
  });
});

describe("glossaryConfidence", () => {
  it("grows with the occurrences, stays within the base and the cap", () => {
    fc.assert(
      fc.property(
        confidence(),
        fc.integer({ min: 1, max: 50 }),
        confidence(),
        confidence(),
        (base, occurrences, bonus, cap) => {
          const options = { bonus, cap };
          const value = glossaryConfidence(base, occurrences, options);
          expect(value).toBeLessThanOrEqual(Math.max(base, cap));
          expect(value).toBeGreaterThanOrEqual(Math.min(base, cap));
          expect(glossaryConfidence(base, occurrences + 1, options)).toBeGreaterThanOrEqual(value);
        },
      ),
      RUNS,
    );
  });
});
