import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { nodeFileSystem, type FileSystem, type UiComponent } from "@concordance-wiki/core";
import { build } from "esbuild";

import { byCodeUnit } from "../order.js";
import { CATEGORY_ISLAND } from "../theme/default/category-island.js";
import { DOCUMENT_VIEWER_ISLAND } from "../theme/default/document-viewer.js";
import { MENTIONS_ISLAND } from "../theme/default/mentions-island.js";
import { MODE_SWITCH_ISLAND } from "../theme/default/mode-switch.js";
import { SEARCH_ISLAND } from "../search/shared.js";
import { defaultUiComponents } from "../theme/default/plugin.js";
import { TRAIL_ISLAND } from "../theme/default/trail.js";

/** The bundle of the PDF viewer, imported on demand by the document island, never by a page. */
export const VIEWER_ISLAND = "viewer-pdf";
/** The worker of pdf.js, a second bundle the viewer points its `workerSrc` at. */
export const VIEWER_WORKER_ISLAND = "viewer-pdf-worker";

export interface IslandEntry {
  name: string;
  /** Absolute path of the hydration entry module. */
  entry: string;
  /**
   * Bundled as a classic script rather than a module: browsers load a classic script from a
   * `file://` page, whereas a module script from `file://` is refused by some of them.
   */
  classic?: boolean;
}

export interface IslandBundle {
  name: string;
  /** File name under the output folder, carrying a hash of the content. */
  file: string;
  bytes: number;
  /** Loaded with a deferred classic script tag instead of a module one. */
  classic?: boolean;
}

export interface BundleOptions {
  outDir: string;
  islands: IslandEntry[];
  fileSystem?: FileSystem;
}

/** The island a UI component contribution becomes: its slot names the island, its bundle is the hydration entry. */
export function islandOf(component: UiComponent): IslandEntry {
  return { name: component.slot, entry: component.bundle };
}

/** The islands shipped with the default theme, each with its hydration entry next to this module, then its UI components. */
export function defaultIslands(): IslandEntry[] {
  // No extension: the bundler picks the compiled module in a build and the source under test.
  return [
    {
      name: CATEGORY_ISLAND,
      entry: fileURLToPath(new URL("./category-list.client", import.meta.url)),
    },
    {
      name: DOCUMENT_VIEWER_ISLAND,
      entry: fileURLToPath(new URL("./document-viewer.client", import.meta.url)),
    },
    {
      name: MENTIONS_ISLAND,
      entry: fileURLToPath(new URL("./mentions-panel.client", import.meta.url)),
    },
    {
      name: MODE_SWITCH_ISLAND,
      entry: fileURLToPath(new URL("./mode-switch.client", import.meta.url)),
    },
    {
      name: SEARCH_ISLAND,
      entry: fileURLToPath(new URL("./search.client", import.meta.url)),
      classic: true,
    },
    {
      name: TRAIL_ISLAND,
      entry: fileURLToPath(new URL("./trail.client", import.meta.url)),
    },
    ...defaultUiComponents().map(islandOf),
  ];
}

/** The default islands, then the contributed ones whose name no earlier island took; sorted by name. */
export function mergeIslands(
  defaults: readonly IslandEntry[],
  contributed: readonly IslandEntry[],
): IslandEntry[] {
  const merged = new Map<string, IslandEntry>();
  for (const island of [...defaults, ...contributed]) {
    if (!merged.has(island.name)) merged.set(island.name, island);
  }
  return [...merged.values()].sort((a, b) => byCodeUnit(a.name, b.name));
}

/**
 * The viewer and its worker, built from the legacy build of pdf.js: heavy, so only a site with a
 * PDF to show bundles them, and no page loads them before the reader asks.
 */
export function viewerIslands(): IslandEntry[] {
  const require = createRequire(import.meta.url);
  return [
    {
      name: VIEWER_ISLAND,
      entry: fileURLToPath(new URL("./viewer-pdf.client", import.meta.url)),
    },
    {
      name: VIEWER_WORKER_ISLAND,
      entry: require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    },
  ];
}

/**
 * The first eight hexadecimal characters, upper case, of the SHA-256 of the bytes: the bundler's
 * own `[hash]` also folds in the path of the entry point, so it changes from one checkout to
 * another for the same content; this one depends on the content alone.
 */
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 8).toUpperCase();
}

/** One minified script per island, a module unless the island asks for a classic one, named after its content, written through the file system. */
export async function bundleIslands(options: BundleOptions): Promise<IslandBundle[]> {
  const fileSystem = options.fileSystem ?? nodeFileSystem;
  const bundles: IslandBundle[] = [];
  for (const island of [...options.islands].sort((a, b) => byCodeUnit(a.name, b.name))) {
    const result = await build({
      entryPoints: { [island.name]: island.entry },
      outdir: options.outDir,
      entryNames: "[name]",
      bundle: true,
      format: island.classic === true ? "iife" : "esm",
      platform: "browser",
      target: "es2022",
      minify: true,
      legalComments: "none",
      sourcemap: false,
      write: false,
      jsx: "automatic",
      jsxImportSource: "preact",
      // No tsconfig lookup: a checkout has one next to the sources, a published package has none,
      // and its strictness setting would otherwise decide whether the bundle starts with "use strict".
      tsconfigRaw: {},
      logLevel: "silent",
    });
    for (const output of result.outputFiles) {
      const file = `${island.name}-${contentHash(output.contents)}.js`;
      fileSystem.writeBytes(`${options.outDir}/${file}`, output.contents);
      bundles.push({
        name: island.name,
        file,
        bytes: output.contents.byteLength,
        ...(island.classic === true ? { classic: true } : {}),
      });
    }
  }
  return bundles;
}
