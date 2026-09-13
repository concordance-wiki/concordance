import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { bundleIslands, contentHash, defaultIslands } from "../../src/islands/bundle.js";

describe("defaultIslands", () => {
  it("declares the mentions panel, mode switch and search islands with their entries next to the bundler, the search one classic", () => {
    const islands = defaultIslands();
    expect(islands.map((island) => island.name)).toEqual([
      "mentions-panel",
      "mode-switch",
      "search",
    ]);
    expect(islands[0]?.entry.endsWith("/src/islands/mentions-panel.client")).toBe(true);
    expect(islands[1]?.entry.endsWith("/src/islands/mode-switch.client")).toBe(true);
    expect(islands[2]?.entry.endsWith("/src/islands/search.client")).toBe(true);
    expect(islands.map((island) => island.classic)).toEqual([undefined, undefined, true]);
  });
});

describe("contentHash", () => {
  it("names a bundle after its bytes alone, whatever the path it was built from", () => {
    const bytes = new TextEncoder().encode("export const a = 1;\n");
    expect(contentHash(bytes)).toMatch(/^[0-9A-F]{8}$/);
    expect(contentHash(bytes)).toBe(contentHash(new Uint8Array(bytes)));
    expect(contentHash(new TextEncoder().encode("export const a = 2;\n"))).not.toBe(
      contentHash(bytes),
    );
  });

  it("gives the bundle file that hash", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    for (const bundle of bundles) {
      const bytes = fileSystem.readBytes(`/out/${bundle.file}`);
      expect(bundle.file).toBe(`${bundle.name}-${contentHash(bytes)}.js`);
    }
  });
});

describe("bundleIslands", () => {
  it("writes one minified module per island, named after its content, and reports its size", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({
      outDir: "/site/assets",
      islands: defaultIslands(),
      fileSystem,
    });
    expect(bundles).toHaveLength(3);
    const [bundle] = bundles;
    expect(bundle?.name).toBe("mentions-panel");
    expect(bundle?.file).toMatch(/^mentions-panel-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/site/assets/${bundle?.file ?? ""}`);
    expect(written.length).toBe(bundle?.bytes);
    expect(written).toContain('"concordance-island"');
    expect(written).toContain('"mentions-panel"');
    expect(written).not.toContain("Island(");
    expect(written).not.toContain("\n//");
    expect(written).not.toContain("sourceMappingURL");
    expect(written.split("\n").length).toBeLessThan(5);
  });

  it("bundles the mode switch without any framework: a few hundred bytes reading the stored choice", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "mode-switch");
    expect(bundle?.file).toMatch(/^mode-switch-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(bundle?.bytes).toBeLessThan(1_500);
    expect(written).toContain('"concordance-mode"');
    expect(written).toContain('[data-island="mode-switch"]');
    expect(written).toContain("aria-pressed");
    expect(written).not.toContain("preact");
    expect(written).not.toContain("hydrate");
  });

  it("bundles the search island as a classic script, without import or export, so that a file:// page loads it", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "search");
    expect(bundle?.file).toMatch(/^search-[A-Z0-9]{8}\.js$/);
    expect(bundle?.classic).toBe(true);
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(written.startsWith("(()=>{")).toBe(true);
    expect(written).not.toContain("import ");
    expect(written).not.toContain("export ");
    expect(written).toContain("__concordanceSearch");
    expect(written).toContain('"search"');
    expect(written).not.toContain("useSlot");
    expect(written).not.toContain("hydrate");
    expect(bundles.find((candidate) => candidate.name === "mentions-panel")?.classic).toBe(
      undefined,
    );
  });

  it("gives byte-identical bundles from one run to the next, whatever the output folder", async () => {
    const first = memoryFileSystem();
    const second = memoryFileSystem();
    const a = await bundleIslands({ outDir: "/one", islands: defaultIslands(), fileSystem: first });
    const b = await bundleIslands({
      outDir: "/two/deeper",
      islands: defaultIslands(),
      fileSystem: second,
    });
    expect(a).toEqual(b);
    expect(first.readText(`/one/${a[0]?.file ?? ""}`)).toBe(
      second.readText(`/two/deeper/${b[0]?.file ?? ""}`),
    );
  });

  it("writes to the real file system when none is injected", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "concordance-islands-"));
    try {
      const bundles = await bundleIslands({ outDir, islands: defaultIslands() });
      expect(readdirSync(outDir).sort()).toEqual(bundles.map((bundle) => bundle.file).sort());
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("sorts the bundles by island name whatever the declaration order", async () => {
    const fileSystem = memoryFileSystem();
    const [entry] = defaultIslands();
    const islands = [
      { name: "zeta", entry: entry?.entry ?? "" },
      { name: "alpha", entry: entry?.entry ?? "" },
    ];
    const bundles = await bundleIslands({ outDir: "/out", islands, fileSystem });
    expect(bundles.map((bundle) => bundle.name)).toEqual(["alpha", "zeta"]);
    expect(fileSystem.listFiles("/out")).toHaveLength(2);
  });
});
