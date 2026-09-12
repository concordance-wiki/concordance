import type { FileSystem } from "@concordance-wiki/core";

/** Everything a command touches outside its arguments, injected so that tests observe it. */
export interface CommandIo {
  fs: FileSystem;
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

export const exitCodes = {
  ok: 0,
  invalid: 1,
  failure: 2,
} as const;

export type ExitCode = (typeof exitCodes)[keyof typeof exitCodes];
