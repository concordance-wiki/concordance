import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const plugins = resolve(fileURLToPath(import.meta.url), "../../../../../plugins");

function sources(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const file = join(directory, name);
      return statSync(file).isDirectory() ? sources(file) : [file];
    });
}

describe("the official plugins declare the plugin API version through the constant", () => {
  it("has no source file spelling apiVersion as a literal", () => {
    const files = readdirSync(plugins, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .flatMap((name) => sources(join(plugins, name, "src")));
    expect(files.length).toBeGreaterThan(0);
    const offending = files.filter((file) => /apiVersion:\s*"/u.test(readFileSync(file, "utf8")));
    expect(offending).toEqual([]);
  });
});
