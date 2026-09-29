import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");
const PLUGIN_PREFIX = "@concordance-wiki/plugin-";
/** What a plugin's own code may import of the workspace: the core, and nothing else. */
const PLUGIN_MAY_IMPORT = new Set(["@concordance-wiki/core"]);
const DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"];

function sources(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const file = join(directory, name);
      return statSync(file).isDirectory() ? sources(file) : [file];
    });
}

/** The folders of `packages/` and of `plugins/`, by name, each with its manifest read. */
function workspaces(group: string): { name: string; directory: string; manifest: Manifest }[] {
  const base = join(root, group);
  return readdirSync(base)
    .sort()
    .filter((name) => existsSync(join(base, name, "package.json")))
    .map((name) => ({
      name,
      directory: join(base, name),
      manifest: JSON.parse(readFileSync(join(base, name, "package.json"), "utf8")) as Manifest,
    }));
}

type Manifest = Record<string, Record<string, string> | undefined>;

/** Every workspace package a file imports, `import` and `import(` alike. */
function imported(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [
    ...text.matchAll(/from "(@concordance-wiki\/[^"]+)"|import\("(@concordance-wiki\/[^"]+)"/gu),
  ]
    .map((match) => match[1] ?? match[2] ?? "")
    .map((name) => name.split("/").slice(0, 2).join("/"));
}

function declared(manifest: Manifest, fields: readonly string[]): string[] {
  return fields.flatMap((field) => Object.keys(manifest[field] ?? {})).sort();
}

describe("no package of the core imports a plugin", () => {
  // The core reads markdown and produces JSON; everything about an office format, a contract or a
  // system tool is a plugin the command line loads. A package that imported one would tie the two.
  it.each(workspaces("packages"))("$name imports no plugin in its sources", ({ directory }) => {
    const files = sources(join(directory, "src"));
    expect(files.length).toBeGreaterThan(0);
    const offending = files.filter((file) =>
      imported(file).some((name) => name.startsWith(PLUGIN_PREFIX)),
    );
    expect(offending.map((file) => relative(root, file))).toEqual([]);
  });

  // A plugin in devDependencies is a plugin the tests load, which the published package never
  // carries: the command line's own tests build a corpus with the office reader.
  it.each(workspaces("packages"))("$name declares no plugin it would ship", ({ manifest }) => {
    expect(
      declared(manifest, DEPENDENCY_FIELDS).filter((name) => name.startsWith(PLUGIN_PREFIX)),
    ).toEqual([]);
  });
});

describe("a plugin talks to the core alone", () => {
  // Two plugins that knew each other would have to be released together, and the one a project
  // leaves out would take the other down with it. What they share belongs in the core.
  it.each(workspaces("plugins"))("$name imports the core and no other plugin", ({ directory }) => {
    const files = sources(join(directory, "src"));
    expect(files.length).toBeGreaterThan(0);
    const offending = files.flatMap((file) =>
      imported(file)
        .filter((name) => !PLUGIN_MAY_IMPORT.has(name))
        .map((name) => `${relative(root, file)}: ${name}`),
    );
    expect(offending).toEqual([]);
  });

  it.each(workspaces("plugins"))("$name ships a dependency on the core alone", ({ manifest }) => {
    const workspace = declared(manifest, DEPENDENCY_FIELDS).filter((name) =>
      name.startsWith("@concordance-wiki/"),
    );
    expect(workspace).toEqual([...PLUGIN_MAY_IMPORT]);
  });
});
