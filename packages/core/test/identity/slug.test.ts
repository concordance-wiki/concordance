import { describe, expect, it } from "vitest";

import { slugify } from "../../src/identity/slug.js";

describe("slugify", () => {
  it("lowercases and removes accents", () => {
    expect(slugify("Réglementation générale")).toBe("reglementation-generale");
    expect(slugify("Ça Été Vu")).toBe("ca-ete-vu");
  });

  it("replaces spaces and underscores by one hyphen", () => {
    expect(slugify("confirm a  link")).toBe("confirm-a-link");
    expect(slugify("confirm_a_link")).toBe("confirm-a-link");
    expect(slugify("confirm _ link")).toBe("confirm-link");
  });

  it("replaces dots like any other character", () => {
    expect(slugify("notes.v2")).toBe("notes-v2");
  });

  it("keeps digits and hyphens", () => {
    expect(slugify("2026-03-12-links-workshop")).toBe("2026-03-12-links-workshop");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--Link (draft)--")).toBe("link-draft");
    expect(slugify(" .hidden ")).toBe("hidden");
  });

  it("names a segment with no letter or digit left after a stable hash, never empty, so that the identifier stays valid", () => {
    expect(slugify("日本語")).toMatch(/^u[0-9a-f]{8}$/);
    expect(slugify("日本語")).toBe(slugify("日本語"));
    expect(slugify("日本語")).not.toBe(slugify("---"));
    expect(slugify("---")).toMatch(/^u[0-9a-f]{8}$/);
    expect(slugify("")).toMatch(/^u[0-9a-f]{8}$/);
    expect(slugify("日本語")).not.toBe(slugify("中文"));
  });

  it("is idempotent and never yields a character outside [a-z0-9-]", () => {
    const alphabet = [
      "a",
      "Z",
      "0",
      "9",
      "-",
      "_",
      ".",
      " ",
      "é",
      "É",
      "à",
      "ç",
      "/",
      "ß",
      "(",
      "!",
    ];
    const samples: string[] = [];
    for (let seed = 1; seed <= 500; seed++) {
      let state = seed;
      let sample = "";
      for (let length = 0; length < 12; length++) {
        state = (state * 1103515245 + 12345) % 2147483648;
        sample += alphabet[state % alphabet.length] ?? "";
      }
      samples.push(sample);
    }
    for (const sample of samples) {
      const slug = slugify(sample);
      expect(slug, sample).toMatch(/^[a-z0-9-]*$/);
      expect(slug, sample).not.toMatch(/^-|-$/);
      expect(slugify(slug), sample).toBe(slug);
    }
  });
});
