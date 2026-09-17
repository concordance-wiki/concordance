import { describe, expect, it } from "vitest";

import { collation } from "../../src/index.js";

describe("collation orders texts from its options alone, without the collation data of the runtime", () => {
  const base = collation({ sensitivity: "base", numeric: true });

  it("sets accents and case aside under base sensitivity, digits compared by value", () => {
    expect(["effet", "Écran", "eau", "item 10", "item 2", "item 002"].sort(base)).toEqual([
      "eau",
      "Écran",
      "effet",
      "item 2",
      "item 002",
      "item 10",
    ]);
    expect(base("Écran", "ecran")).toBe(0);
    expect(base("Resume", "résumé")).toBe(0);
    expect(base("item 2", "item 10")).toBeLessThan(0);
    expect(base("item 10", "item 2")).toBeGreaterThan(0);
  });

  it("orders a run of digits after the text before it and a shorter text before its extension", () => {
    expect(base("item", "item 2")).toBeLessThan(0);
    expect(base("item2", "item")).toBeGreaterThan(0);
    expect(base("item", "item2")).toBeLessThan(0);
    expect(base("item 2 bis", "item 2")).toBeGreaterThan(0);
    expect(base("2 items", "item")).toBeLessThan(0);
  });

  it("compares digits as text when numeric is not asked for", () => {
    expect(collation({ sensitivity: "base" })("item 10", "item 2")).toBeLessThan(0);
  });

  it("keeps the accents under accent sensitivity and the case under case sensitivity, both under variant", () => {
    expect(collation({ sensitivity: "accent" })("Écran", "ecran")).toBeGreaterThan(0);
    expect(collation({ sensitivity: "accent" })("Écran", "écran")).toBe(0);
    expect(collation({ sensitivity: "case" })("Écran", "ecran")).toBeLessThan(0);
    expect(collation({ sensitivity: "case" })("Écran", "Ecran")).toBe(0);
    expect(collation({})("Écran", "Ecran")).toBeGreaterThan(0);
    expect(collation({})("écran", "ecran")).toBeGreaterThan(0);
  });

  it("sets punctuation, symbols and spaces aside when asked to", () => {
    const loose = collation({ sensitivity: "base", ignorePunctuation: true });
    expect(loose("e-mail", "email")).toBe(0);
    expect(loose("key word", "keyword")).toBe(0);
    expect(base("e-mail", "email")).not.toBe(0);
  });

  it("gives the same order whatever the runtime: a precomposed and a decomposed accent compare equal", () => {
    expect(collation({})("é", "é")).toBe(0);
  });
});
