import { describe, expect, it } from "vitest";

import { type PluralRule, singularize } from "../../src/index.js";

const rules: readonly PluralRule[] = [
  { ending: "ies", singular: "y", minLength: 5 },
  { ending: "xes", singular: "x", minLength: 5 },
  { ending: "s", singular: "", minLength: 4 },
];

describe("simple plural rules per locale", () => {
  it("applies the first rule whose ending the word carries", () => {
    expect(singularize("policies", rules)).toBe("policy");
    expect(singularize("payments", rules)).toBe("payment");
  });

  it("replaces the ending by the singular of the rule", () => {
    expect(singularize("chevaux", [{ ending: "aux", singular: "al", minLength: 6 }])).toBe(
      "cheval",
    );
  });

  it("applies a rule to a word exactly as long as its minimum length", () => {
    expect(singularize("boxes", rules)).toBe("box");
  });

  it("leaves a word shorter than the minimum length of the rule alone", () => {
    expect(singularize("bus", rules)).toBe("bus");
  });

  it("leaves a word that carries no rule ending alone", () => {
    expect(singularize("annual", rules)).toBe("annual");
  });

  it("returns the word unchanged with an empty rule list", () => {
    expect(singularize("policies", [])).toBe("policies");
  });
});
