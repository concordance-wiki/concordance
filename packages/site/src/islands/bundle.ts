import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem, type FileSystem } from "@concordance-wiki/core";
import { build } from "esbuild";

import { byCodeUnit } from "../order.js";
import { MENTIONS_ISLAND } from "../theme/default/mentions-more.js";

export interface IslandEntry {
  name: string;
  /** Absolute path of the hydration entry module. */
  entry: string;
}

export interface IslandBundle {
  name: string;
  /** File name under the output folder, carrying a hash of the content. */
  file: string;
  bytes: number;
}

export interface BundleOptions {
  outDir: string;
  islands: IslandEntry[];
  fileSystem?: FileSystem;
}

/** The islands shipped with the default theme, each with its hydration entry next to this module. */
export function defaultIslands(): IslandEntry[] {
  // No extension: the bundler picks the compiled module in a build and the source under test.
  return [
    {
      name: MENTIONS_ISLAND,
      entry: fileURLToPath(new URL("./mentions-panel.client", import.meta.url)),
    },
  ];
}

/** One minified module per island, named after its content, written through the file system. */
export async function bundleIslands(options: BundleOptions): Promise<IslandBundle[]> {
  const fileSystem = options.fileSystem ?? nodeFileSystem;
  const bundles: IslandBundle[] = [];
  for (const island of [...options.islands].sort((a, b) => byCodeUnit(a.name, b.name))) {
    const result = await build({
      entryPoints: { [island.name]: island.entry },
      outdir: options.outDir,
      entryNames: "[name]-[hash]",
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify: true,
      legalComments: "none",
      sourcemap: false,
      write: false,
      jsx: "automatic",
      jsxImportSource: "preact",
      logLevel: "silent",
    });
    for (const output of result.outputFiles) {
      const file = basename(output.path);
      fileSystem.writeBytes(`${options.outDir}/${file}`, output.contents);
      bundles.push({ name: island.name, file, bytes: output.contents.byteLength });
    }
  }
  return bundles;
}
