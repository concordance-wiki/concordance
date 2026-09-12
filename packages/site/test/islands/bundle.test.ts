import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { bundleIslands, defaultIslands } from "../../src/islands/bundle.js";

describe("defaultIslands", () => {
  it("declares the mentions panel island with its hydration entry next to the bundler", () => {
    const islands = defaultIslands();
    expect(islands.map((island) => island.name)).toEqual(["mentions-panel"]);
    expect(islands[0]?.entry.endsWith("/src/islands/mentions-panel.client")).toBe(true);
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
    expect(bundles).toHaveLength(1);
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
      expect(readdirSync(outDir)).toEqual([bundles[0]?.file]);
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
