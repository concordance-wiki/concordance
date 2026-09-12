import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const core = resolve(fileURLToPath(import.meta.url), "../../..");

function sources(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const file = join(directory, name);
      return statSync(file).isDirectory() ? sources(file) : [file];
    });
}

describe("the core imports no plugin", () => {
  it("has no source file importing an official plugin package", () => {
    const files = sources(join(core, "src"));
    expect(files.length).toBeGreaterThan(0);
    const offending = files.filter((file) =>
      readFileSync(file, "utf8").includes("@concordance-wiki/plugin-"),
    );
    expect(offending).toEqual([]);
  });

  it("declares no dependency on an official plugin package", () => {
    const manifest = JSON.parse(readFileSync(join(core, "package.json"), "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    const declared = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
      .flatMap((field) => Object.keys(manifest[field] ?? {}))
      .filter((name) => name.startsWith("@concordance-wiki/plugin-"));
    expect(declared).toEqual([]);
  });
});
