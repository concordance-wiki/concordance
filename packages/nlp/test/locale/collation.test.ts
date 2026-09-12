import { describe, expect, it } from "vitest";

import { languagePack } from "../../src/index.js";

describe("the fr pack collates with French rules", () => {
  const fr = languagePack("fr");

  it("orders écran between eau and effet", () => {
    expect(["effet", "écran", "eau"].sort(fr.compare)).toEqual(["eau", "écran", "effet"]);
    expect(fr.compare("eau", "écran")).toBeLessThan(0);
    expect(fr.compare("écran", "effet")).toBeLessThan(0);
  });

  it("ignores case and accents when they are the only difference", () => {
    expect(fr.compare("Écran", "ecran")).toBe(0);
  });

  it("orders item 2 before item 10", () => {
    expect(fr.compare("item 2", "item 10")).toBeLessThan(0);
  });

  it("exposes the collator it compares with", () => {
    expect(fr.collator.resolvedOptions()).toMatchObject({
      locale: "fr",
      sensitivity: "base",
      numeric: true,
    });
  });
});

describe("the en pack collates with English rules", () => {
  const en = languagePack("en");

  it("orders item 2 before item 10", () => {
    expect(["item 10", "item 2", "item 1"].sort(en.compare)).toEqual([
      "item 1",
      "item 2",
      "item 10",
    ]);
    expect(en.compare("item 2", "item 10")).toBeLessThan(0);
    expect(en.compare("item 10", "item 2")).toBeGreaterThan(0);
  });

  it("ignores case and accents when they are the only difference", () => {
    expect(en.compare("Resume", "résumé")).toBe(0);
  });

  it("exposes the collator it compares with", () => {
    expect(en.collator.resolvedOptions()).toMatchObject({
      locale: "en",
      sensitivity: "base",
      numeric: true,
    });
  });
});
