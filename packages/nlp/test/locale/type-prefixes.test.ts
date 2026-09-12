import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { languagePack } from "../../src/index.js";

const candidates = ["../../../profile/default.yaml", "../../../../profiles/default.yaml"];

function profileTypePrefixes(): Record<string, Record<string, string[]>> {
  const url = candidates
    .map((candidate) => new URL(candidate, import.meta.url))
    .find((candidate) => existsSync(candidate));
  expect(url).toBeDefined();
  // The profile is validated against its schema by the profile package; the block has this shape.
  const profile = parse(readFileSync(url ?? "", "utf8")) as {
    type_prefixes: Record<string, Record<string, string[]>>;
  };
  return profile.type_prefixes;
}

describe.each(["en", "fr"] as const)("the %s pack recognises type prefixes", (locale) => {
  it("matches the type_prefixes block of the default profile", () => {
    expect(languagePack(locale).typePrefixes).toEqual(profileTypePrefixes()[locale]);
  });

  it("lists lowercase words only", () => {
    for (const words of Object.values(languagePack(locale).typePrefixes)) {
      for (const word of words) {
        expect(word).toBe(word.toLowerCase());
      }
    }
  });
});
