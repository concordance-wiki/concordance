import { posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { PLUGIN_API_VERSION } from "../../src/plugin/api.js";
import { isPluginManifest } from "../../src/plugin/define.js";
import { importPlugin } from "../../src/plugin/node-loader.js";

const examplePlugin = pathToFileURL(
  resolve(fileURLToPath(import.meta.url), "../../../../../fixtures/plugins/example/index.mjs"),
).href;

describe("importPlugin", () => {
  it("returns the default export of a package exporting a definePlugin manifest", async () => {
    const loaded = await importPlugin(examplePlugin);
    expect(isPluginManifest(loaded)).toBe(true);
    if (isPluginManifest(loaded)) {
      expect(loaded.name).toBe("@concordance-wiki/fixture-plugin-example");
      expect(loaded.apiVersion).toBe(PLUGIN_API_VERSION);
    }
  });

  it("returns whatever a module exports by default, even when it is not a manifest", async () => {
    // The default export of node:path is the platform path object, which carries the posix variant.
    expect(((await importPlugin("node:path")) as { posix: unknown }).posix).toBe(posix);
  });
});
