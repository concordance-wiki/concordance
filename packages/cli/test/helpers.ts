import { memoryFileSystem } from "@concordance-wiki/core";

import type { CommandIo } from "../src/io.js";

export interface RecordedIo extends CommandIo {
  fs: ReturnType<typeof memoryFileSystem>;
  stdout: string[];
  stderr: string[];
}

export const validConfig =
  "version: 1\nproject: { name: Wiki }\nsources: [{ name: notes, path: ./notes }]\n";

export function recordedIo(files: Record<string, string> = {}, cwd = "/work"): RecordedIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    fs: memoryFileSystem(files),
    cwd,
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
  };
}
