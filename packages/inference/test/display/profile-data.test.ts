import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

const templateSources = [
  { dir: new URL("../../../site/src/theme/default/", import.meta.url), suffix: ".tsx" },
  { dir: new URL("../../src/display/", import.meta.url), suffix: ".ts" },
];

function sources(): { path: string; text: string }[] {
  return templateSources.flatMap(({ dir, suffix }) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(suffix))
      .sort()
      .map((name) => {
        const url = new URL(name, dir);
        return { path: fileURLToPath(url), text: readFileSync(url, "utf8") };
      }),
  );
}

describe("the reordering of neighbours", () => {
  it("is profile data, never a condition in the template code", () => {
    const slugs = Object.keys(loadDefaultProfile().types);
    const files = sources();
    expect(files.length).toBeGreaterThan(4);
    expect(slugs.length).toBeGreaterThan(30);
    const hits: string[] = [];
    for (const { path, text } of files) {
      for (const slug of slugs) {
        const quoted = new RegExp(`["'\`]${slug}["'\`]`);
        const property = new RegExp(`\\.types\\.${slug}\\b`);
        if (quoted.test(text) || property.test(text)) {
          hits.push(`${path}: ${slug}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
