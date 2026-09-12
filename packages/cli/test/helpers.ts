import {
  fixedClock,
  memoryFileSystem,
  type FileHistory,
  type GitClient,
} from "@concordance-wiki/core";

import type { CommandIo } from "../src/io.js";

export interface RecordedIo extends CommandIo {
  fs: ReturnType<typeof memoryFileSystem>;
  git: FakeGit;
  stdout: string[];
  stderr: string[];
}

export const validConfig =
  "version: 1\nproject: { name: Wiki }\nsources: [{ name: notes, path: ./notes }]\n";

/** A git client that materialises a fixed file into the clone directory and fails on demand. */
export class FakeGit implements GitClient {
  readonly calls: string[] = [];
  failing = new Set<string>();

  constructor(private readonly fs: ReturnType<typeof memoryFileSystem>) {}

  clone(url: string, ref: string, directory: string): Promise<void> {
    this.calls.push(`clone ${url} ${ref} ${directory}`);
    if (this.failing.has(url)) {
      return Promise.reject(new Error(`fatal: repository '${url}' not found`));
    }
    this.fs.writeText(`${directory}/README.md`, "# cloned\n");
    return Promise.resolve();
  }

  update(directory: string, ref: string): Promise<void> {
    this.calls.push(`update ${directory} ${ref}`);
    return Promise.resolve();
  }

  head(): Promise<string> {
    return Promise.resolve("0123456789abcdef0123456789abcdef01234567");
  }

  history(): Promise<Map<string, FileHistory>> {
    return Promise.resolve(
      new Map([
        [
          "README.md",
          {
            commit: "0123456789abcdef0123456789abcdef01234567",
            modifiedAt: "2026-01-02T03:04:05Z",
          },
        ],
      ]),
    );
  }
}

export function recordedIo(files: Record<string, string> = {}, cwd = "/work"): RecordedIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fs = memoryFileSystem(files);
  return {
    fs,
    git: new FakeGit(fs),
    clock: fixedClock("2026-09-12T12:00:00Z"),
    cwd,
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
  };
}
