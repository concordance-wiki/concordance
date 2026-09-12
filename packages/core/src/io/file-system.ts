import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** The file system operations the tool needs, injected so that tests run against doubles. */
export interface FileSystem {
  exists(path: string): boolean;
  readText(path: string): string;
  /** Raw content, for callers that decide how to decode it. */
  readBytes(path: string): Uint8Array;
  writeText(path: string, content: string): void;
  writeBytes(path: string, bytes: Uint8Array): void;
  /** Deletes a file, or a folder with everything under it; a missing path is not an error. */
  remove(path: string): void;
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
  readBytes: (path) => readFileSync(path),
  writeText: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  },
  writeBytes: (path, bytes) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  },
  remove: (path) => {
    rmSync(path, { recursive: true, force: true });
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

const encoder = new TextEncoder();
const lenientDecoder = new TextDecoder();

/** An in-memory file system keyed by absolute forward-slash paths. Dates default to the epoch. */
export function memoryFileSystem(
  files: Record<string, string> = {},
  dates: Record<string, string> = {},
): MemoryFileSystem {
  const store = new Map(Object.entries(files));
  const blobs = new Map<string, Uint8Array>();
  const stamps = new Map(Object.entries(dates));
  const paths = () => [...store.keys(), ...blobs.keys()];
  const missing = (path: string) => new Error(`ENOENT: no such file, open '${path}'`);
  return {
    files: store,
    dates: stamps,
    exists: (path) =>
      store.has(path) || blobs.has(path) || paths().some((key) => key.startsWith(`${path}/`)),
    readText: (path) => {
      const content = store.get(path);
      if (content !== undefined) return content;
      const bytes = blobs.get(path);
      if (bytes === undefined) throw missing(path);
      return lenientDecoder.decode(bytes);
    },
    readBytes: (path) => {
      const bytes = blobs.get(path);
      if (bytes !== undefined) return bytes;
      const content = store.get(path);
      if (content === undefined) throw missing(path);
      return encoder.encode(content);
    },
    writeText: (path, content) => {
      blobs.delete(path);
      store.set(path, content);
    },
    writeBytes: (path, bytes) => {
      store.delete(path);
      blobs.set(path, bytes);
    },
    remove: (path) => {
      for (const key of paths()) {
        if (key === path || key.startsWith(`${path}/`)) {
          store.delete(key);
          blobs.delete(key);
        }
      }
    },
    listFiles: (directory) => {
      const prefix = `${directory}/`;
      return paths()
        .filter(
          (key) => key.startsWith(prefix) && !key.slice(prefix.length).split("/").includes(".git"),
        )
        .map((key) => key.slice(prefix.length))
        .sort();
    },
    modifiedAt: (path) => stamps.get(path) ?? "1970-01-01T00:00:00.000Z",
  };
}
