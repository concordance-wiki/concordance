import { fileURLToPath } from "node:url";

import { nodeFileSystem, type FileSystem } from "@concordance-wiki/core";

/** URL of the folder holding the nearest `package.json` above a module, with a trailing slash. */
export function packageRootOf(moduleUrl: string, exists: (path: string) => boolean): string {
  let folder = new URL("./", moduleUrl);
  for (;;) {
    if (exists(new URL("package.json", folder).pathname)) {
      return folder.href;
    }
    const parent = new URL("../", folder);
    if (parent.href === folder.href) {
      throw new Error(`no package.json above ${moduleUrl}`);
    }
    folder = parent;
  }
}

/** Imports a module of a plugin package by its path relative to the package root. */
export async function importThemeModule(
  plugin: string,
  path: string,
  fileSystem: FileSystem = nodeFileSystem,
): Promise<unknown> {
  const root = packageRootOf(import.meta.resolve(plugin), (path) => fileSystem.exists(path));
  // The specifier is data from a manifest: no bundler must try to resolve it ahead of time.
  const module: unknown = await import(/* @vite-ignore */ new URL(path, root).href);
  // A module namespace is always an object; a missing default export reads as undefined.
  return (module as { default?: unknown }).default;
}

/** Absolute folder of a plugin package resolvable by name, for the files a theme contribution names. */
export function packageDirectoryOf(
  plugin: string,
  fileSystem: FileSystem = nodeFileSystem,
): string {
  return fileURLToPath(
    packageRootOf(import.meta.resolve(plugin), (path) => fileSystem.exists(path)),
  );
}
