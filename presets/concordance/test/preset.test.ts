import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");

function packageName(directory: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  // Every package of the repository declares its name.
  return (manifest as { name: string }).name;
}

describe("the concordance preset", () => {
  it("depends on the command line and on every official plugin, as the guides promise", () => {
    const preset: unknown = JSON.parse(
      readFileSync(join(root, "presets/concordance/package.json"), "utf8"),
    );
    const dependencies = Object.keys(
      (preset as { dependencies: Record<string, string> }).dependencies,
    ).sort();
    const plugins = readdirSync(join(root, "plugins"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => packageName(join(root, "plugins", entry.name)));
    expect(dependencies).toEqual(["@concordance-wiki/cli", ...plugins].sort());
  });
});
