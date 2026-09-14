import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  bundleIslands,
  contentHash,
  defaultIslands,
  islandOf,
  mergeIslands,
  viewerIslands,
} from "../../src/islands/bundle.js";
import { defaultUiComponents } from "../../src/theme/default/plugin.js";

describe("defaultIslands", () => {
  it("declares the category list, document viewer, mentions panel, mode switch, panels, search, tabs, table of contents and trail islands with their entries next to the bundler, none a module, then the UI components of the default theme", () => {
    const islands = defaultIslands();
    expect(islands.map((island) => island.name)).toEqual([
      "category-list",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "panels",
      "search",
      "tabs",
      "toc",
      "trail",
      "contract-viewer",
    ]);
    expect(islands[0]?.entry.endsWith("/src/islands/category-list.client")).toBe(true);
    expect(islands[1]?.entry.endsWith("/src/islands/document-viewer.client")).toBe(true);
    expect(islands[2]?.entry.endsWith("/src/islands/mentions-panel.client")).toBe(true);
    expect(islands[3]?.entry.endsWith("/src/islands/mode-switch.client")).toBe(true);
    expect(islands[4]?.entry.endsWith("/src/islands/panels.client")).toBe(true);
    expect(islands[5]?.entry.endsWith("/src/islands/search.client")).toBe(true);
    expect(islands[6]?.entry.endsWith("/src/islands/tabs.client")).toBe(true);
    expect(islands[7]?.entry.endsWith("/src/islands/toc.client")).toBe(true);
    expect(islands[8]?.entry.endsWith("/src/islands/trail.client")).toBe(true);
    expect(islands[9]?.entry.endsWith("/src/islands/contract-viewer.client")).toBe(true);
    expect(islands[9]).toEqual(islandOf(defaultUiComponents()[0] ?? { slot: "", bundle: "" }));
    expect(islands.map((island) => island.module)).toEqual(Array.from({ length: 10 }));
  });

  it("keeps the PDF viewer and its worker apart, the only modules, built from the legacy build of pdf.js only for a site that shows a PDF", () => {
    const islands = viewerIslands();
    expect(islands.map((island) => island.name)).toEqual(["viewer-pdf", "viewer-pdf-worker"]);
    expect(islands[0]?.entry.endsWith("/src/islands/viewer-pdf.client")).toBe(true);
    expect(islands[1]?.entry.endsWith("/pdfjs-dist/legacy/build/pdf.worker.mjs")).toBe(true);
    expect(islands.map((island) => island.module)).toEqual([true, true]);
    expect(defaultIslands().map((island) => island.name)).not.toContain("viewer-pdf");
  });
});

describe("mergeIslands", () => {
  it("keeps the first island of a name, the defaults winning over the contributed ones, and sorts by name", () => {
    const merged = mergeIslands(
      [
        { name: "mode-switch", entry: "/default/mode" },
        { name: "contract-viewer", entry: "/default/viewer" },
      ],
      [
        { name: "pdf-viewer", entry: "/plugin/pdf" },
        { name: "contract-viewer", entry: "/plugin/viewer" },
        { name: "pdf-viewer", entry: "/plugin/pdf-again" },
      ],
    );
    expect(merged).toEqual([
      { name: "contract-viewer", entry: "/default/viewer" },
      { name: "mode-switch", entry: "/default/mode" },
      { name: "pdf-viewer", entry: "/plugin/pdf" },
    ]);
    expect(mergeIslands([], [])).toEqual([]);
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
  it("writes one minified script per island, named after its content, and reports its size", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({
      outDir: "/site/assets",
      islands: defaultIslands(),
      fileSystem,
    });
    expect(bundles).toHaveLength(10);
    const bundle = bundles.find((candidate) => candidate.name === "mentions-panel");
    expect(bundles.map((candidate) => candidate.name)).toEqual([
      "category-list",
      "contract-viewer",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "panels",
      "search",
      "tabs",
      "toc",
      "trail",
    ]);
    expect(bundle?.file).toMatch(/^mentions-panel-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/site/assets/${bundle?.file ?? ""}`);
    expect(bundle?.bytes).toBe(written.length);
    expect(written).toContain('"concordance-island"');
    expect(written).toContain('"mentions-panel"');
    expect(written).not.toContain("Island(");
    expect(written).not.toContain("\n//");
    expect(written).not.toContain("sourceMappingURL");
    expect(written.split("\n").length).toBeLessThan(5);
  });

  it("bundles the contract viewer with the framework alone, under the weight of one page: no fetch of anything but its href, no form", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "contract-viewer");
    expect(bundle?.file).toMatch(/^contract-viewer-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(bundle?.bytes).toBeLessThan(25_000);
    expect(written).toContain('"contract-viewer"');
    expect(written).toContain("Loading the contract");
    expect(written).not.toContain("<form");
    expect(written).not.toContain("XMLHttpRequest");
    expect(written).not.toContain("swagger");
    expect(written.match(/fetch\(/g)).toHaveLength(1);
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

  it("bundles every default island as a classic script, without import or export, so that a file:// page runs it in every browser", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    expect(bundles).toHaveLength(10);
    for (const bundle of bundles) {
      expect(bundle.module, bundle.name).toBeUndefined();
      const written = fileSystem.readText(`/out/${bundle.file}`);
      expect(written.startsWith("(()=>{"), bundle.name).toBe(true);
      expect(written.trimEnd().endsWith("})();"), bundle.name).toBe(true);
      expect(written, bundle.name).not.toMatch(/(^|[;{}\s])import[\s{"']/);
      expect(written, bundle.name).not.toMatch(/(^|[;{}\s])export[\s{]/);
    }
  });

  it("bundles the search island with its shard loader, without the slot machinery nor the framework", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "search");
    expect(bundle?.file).toMatch(/^search-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(written).toContain("__concordanceSearch");
    expect(written).toContain('"search"');
    expect(written).not.toContain("useSlot");
    expect(written).not.toContain("hydrate");
  });

  it("keeps the dynamic import of the viewer in the classic bundle of the document island, which no page loads before the reader asks", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "document-viewer");
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(written.startsWith("(()=>{")).toBe(true);
    expect(written).toContain("import(new URL(");
    expect(bundle?.bytes).toBeLessThan(3_000);
  });

  it("bundles the viewer and its worker as modules, the viewer exporting its opener for the dynamic import", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: viewerIslands(), fileSystem });
    expect(bundles.map((bundle) => [bundle.name, bundle.module])).toEqual([
      ["viewer-pdf", true],
      ["viewer-pdf-worker", true],
    ]);
    const viewer = fileSystem.readText(`/out/${bundles[0]?.file ?? ""}`);
    expect(viewer.startsWith("(()=>{")).toBe(false);
    expect(viewer.trimEnd()).toMatch(/export\{\w+ as openViewer\};$/);
  });

  it("bundles the panels without any framework, under two kilobytes", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "panels");
    expect(bundle?.file).toMatch(/^panels-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(bundle?.bytes).toBeLessThan(2_000);
    expect(written).toContain('"concordance-panels"');
    expect(written).toContain('[data-island="panels"]');
    expect(written).toContain("aria-expanded");
    expect(written).toContain('"["');
    expect(written).not.toContain("preact");
    expect(written).not.toContain("fetch(");
  });

  it("bundles the trail without any framework, under four kilobytes", async () => {
    const fileSystem = memoryFileSystem();
    const bundles = await bundleIslands({ outDir: "/out", islands: defaultIslands(), fileSystem });
    const bundle = bundles.find((candidate) => candidate.name === "trail");
    expect(bundle?.file).toMatch(/^trail-[A-Z0-9]{8}\.js$/);
    const written = fileSystem.readText(`/out/${bundle?.file ?? ""}`);
    expect(bundle?.bytes).toBeLessThan(4_000);
    expect(written).toContain('"concordance-trail"');
    expect(written).toContain('[data-island="trail"]');
    expect(written).toContain('"trail"');
    expect(written).toContain("encodeURIComponent");
    expect(written).toContain("replaceState");
    expect(written).toContain("aria-pressed");
    expect(written).not.toContain("preact");
    expect(written).not.toContain("fetch(");
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
