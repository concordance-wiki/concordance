import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** The file system operations the tool needs, injected so that tests run against doubles. */
export interface FileSystem {
  exists(path: string): boolean;
  readText(path: string): string;
  writeText(path: string, content: string): void;
  /** Files under `directory`, recursively, as sorted forward-slash paths relative to it; `.git` folders are skipped. */
  listFiles(directory: string): string[];
  /** ISO 8601 modification date of a file. */
  modifiedAt(path: string): string;
}

function walk(root: string, directory: string, out: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(root, path, out);
    } else {
      out.push(relative(root, path).split(sep).join("/"));
    }
  }
}

export const nodeFileSystem: FileSystem = {
  exists: (path) => existsSync(path),
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  },
  listFiles: (directory) => {
    const files: string[] = [];
    walk(directory, directory, files);
    return files.sort();
  },
  modifiedAt: (path) => statSync(path).mtime.toISOString(),
};

export interface MemoryFileSystem extends FileSystem {
  files: Map<string, string>;
  dates: Map<string, string>;
}

/** An in-memory file system keyed by absolute forward-slash paths. Dates default to the epoch. */
export function memoryFileSystem(
  files: Record<string, string> = {},
  dates: Record<string, string> = {},
): MemoryFileSystem {
  const store = new Map(Object.entries(files));
  const stamps = new Map(Object.entries(dates));
  return {
    files: store,
    dates: stamps,
    exists: (path) =>
      store.has(path) || [...store.keys()].some((key) => key.startsWith(`${path}/`)),
    readText: (path) => {
      const content = store.get(path);
      if (content === undefined) {
        throw new Error(`ENOENT: no such file, open '${path}'`);
      }
      return content;
    },
    writeText: (path, content) => {
      store.set(path, content);
    },
    listFiles: (directory) => {
      const prefix = `${directory}/`;
      return [...store.keys()]
        .filter(
          (key) => key.startsWith(prefix) && !key.slice(prefix.length).split("/").includes(".git"),
        )
        .map((key) => key.slice(prefix.length))
        .sort();
    },
    modifiedAt: (path) => stamps.get(path) ?? "1970-01-01T00:00:00.000Z",
  };
}
