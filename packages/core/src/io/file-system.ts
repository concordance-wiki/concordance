import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** The file system operations the tool needs, injected so that tests run against doubles. */
export interface FileSystem {
  exists(path: string): boolean;
  readText(path: string): string;
  writeText(path: string, content: string): void;
}

export const nodeFileSystem: FileSystem = {
  exists: (path) => existsSync(path),
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  },
};

export function memoryFileSystem(
  files: Record<string, string> = {},
): FileSystem & { files: Map<string, string> } {
  const store = new Map(Object.entries(files));
  return {
    files: store,
    exists: (path) => store.has(path),
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
  };
}
