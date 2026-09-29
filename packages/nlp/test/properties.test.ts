import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { comparisonForm, comparisonWords } from "../src/text/comparison-form.js";
import { languagePack } from "../src/locale/registry.js";
import { singularize } from "../src/text/singular.js";

/** Generated cases, with a seed: the case a failure names is the same on every machine. */
const RUNS = { numRuns: 300, seed: 20_260_929 } as const;
const en = languagePack("en");
const fr = languagePack("fr");
/** Text as a note holds it: any code point, combining marks and emoji included. */
const text = () => fc.string({ unit: "grapheme", maxLength: 40 });

describe("the comparison form", () => {
  it("is idempotent: the comparison form of a comparison form is itself", () => {
    fc.assert(
      fc.property(text(), fc.constantFrom(en, fr), (written, pack) => {
        const once = comparisonForm(written, pack);
        expect(comparisonForm(once, pack)).toBe(once);
      }),
      RUNS,
    );
  });

  it("holds no upper case, no accent and no double space", () => {
    fc.assert(
      fc.property(text(), fc.constantFrom(en, fr), (written, pack) => {
        const form = comparisonForm(written, pack);
        expect(form).toBe(form.toLowerCase());
        expect(form).not.toMatch(/\p{M}/u);
        expect(form).not.toMatch(/ {2}|^ | $/u);
      }),
      RUNS,
    );
  });

  it("is the words of the text joined by one space", () => {
    fc.assert(
      fc.property(text(), fc.constantFrom(en, fr), (written, pack) => {
        expect(comparisonForm(written, pack)).toBe(comparisonWords(written, pack).join(" "));
      }),
      RUNS,
    );
  });
});

describe("singularize", () => {
  it("is idempotent, and never lengthens a word", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "grapheme", maxLength: 20 }),
        fc.constantFrom(en, fr),
        (word, pack) => {
          const once = singularize(word, pack.plural);
          expect(singularize(once, pack.plural)).toBe(once);
          expect(once.length).toBeLessThanOrEqual(word.length);
        },
      ),
      RUNS,
    );
  });
});
