import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadDefaultProfile, resolveProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { relationLabel } from "../../src/relations/labels.js";

const profile = loadDefaultProfile();
const packages = fileURLToPath(new URL("../../../", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("relationLabel", () => {
  it("displays relation labels from the profile, never from the code", () => {
    const relations = Object.entries(profile.relations);
    expect(relations.length).toBeGreaterThan(20);
    for (const [slug, definition] of relations) {
      expect(relationLabel(profile, slug, "en")).toBe(definition.label.en);
      expect(relationLabel(profile, slug, "fr")).toBe(definition.label.fr);
      const inverse = definition.inverse_label;
      if (definition.directed) {
        // Every directed relation of the default profile reads both ways.
        expect(inverse, slug).toBeDefined();
        expect(relationLabel(profile, slug, "en", { inverse: true })).toBe(inverse?.en);
        expect(relationLabel(profile, slug, "fr", { inverse: true })).toBe(inverse?.fr);
        expect(inverse?.en).not.toBe(definition.label.en);
      } else {
        expect(inverse, slug).toBeUndefined();
        expect(relationLabel(profile, slug, "en", { inverse: true })).toBe(definition.label.en);
      }
    }
  });

  it("reads composes as is part of from the target, in both languages", () => {
    expect(relationLabel(profile, "composes", "en")).toBe("composes");
    expect(relationLabel(profile, "composes", "en", { inverse: true })).toBe("is part of");
    expect(relationLabel(profile, "composes", "fr", { inverse: true })).toBe("fait partie de");
    expect(relationLabel(profile, "composes", "fr", { inverse: false })).toBe("compose");
  });

  it("falls back to the language of a regional locale, then to English", () => {
    expect(relationLabel(profile, "accesses", "fr-CA")).toBe("accède à");
    expect(relationLabel(profile, "accesses", "de")).toBe("accesses");
    expect(relationLabel(profile, "accesses", "de-AT", { inverse: true })).toBe("is accessed by");
  });

  it("reads a directed relation without inverse label the same way from both ends", () => {
    const resolved = resolveProfile(
      "relations:\n  reviews:\n    label: { en: reviews }\n    directed: true\n    allowed: [[role, screen]]\n",
    );
    if (!resolved.ok) throw new Error("the extension is valid");
    expect(relationLabel(resolved.profile, "reviews", "fr", { inverse: true })).toBe("reviews");
  });

  it("reads a relation the profile does not declare as its slug", () => {
    expect(relationLabel(profile, "displays", "en")).toBe("displays");
  });

  it("finds no label of the default profile written in the sources of inference or site", () => {
    const labels = Object.entries(profile.relations).flatMap(([slug, definition]) =>
      [definition.label, definition.inverse_label]
        .flatMap((label) => (label === undefined ? [] : Object.values<string>({ ...label })))
        .filter((label) => label !== slug),
    );
    expect(labels).toContain("is related to");
    expect(labels).toContain("est lié à");
    const files = [
      ...sourceFiles(join(packages, "inference/src")),
      ...sourceFiles(join(packages, "site/src")),
    ];
    expect(files.length).toBeGreaterThan(20);
    const quoted = new RegExp(
      `["'\`](${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})["'\`]`,
    );
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(quoted);
    }
  });
});
