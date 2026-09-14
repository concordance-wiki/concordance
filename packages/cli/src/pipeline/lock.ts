import { resolve } from "node:path";

import {
  formatIssue,
  parseLock,
  type Config,
  type FileSystem,
  type LockCounts,
  type LockFile,
} from "@concordance-wiki/core";

export interface LoadLockInput {
  config: Config;
  /** The folder of `concordance.yaml`, against which `lock` resolves. */
  configDirectory: string;
  fs: FileSystem;
}

/** The lock file the configuration names, read and valid, or the lines that say why the build cannot go on. */
export type LoadedLock = { ok: true; lock?: LockFile } | { ok: false; errors: string[] };

/**
 * Reads the file `lock` names and validates it against the lock schema. A configuration
 * without `lock` applies no decision; a file that is missing or invalid is a configuration
 * error, reported like the issues of `concordance.yaml`, so that a decision is never silently
 * dropped.
 */
export function loadLock(input: LoadLockInput): LoadedLock {
  const declared = input.config.lock;
  if (declared === undefined) return { ok: true };
  const file = resolve(input.configDirectory, declared);
  if (!input.fs.exists(file)) {
    return { ok: false, errors: [`${file}: lock file not found`] };
  }
  const parsed = parseLock(input.fs.readText(file));
  if (!parsed.ok) {
    return { ok: false, errors: parsed.issues.map((issue) => formatIssue(issue, file)) };
  }
  return { ok: true, lock: parsed.lock };
}

/** How many decisions of each block the build applies: every entry listed, the links left aside. */
export function lockCountsOf(lock: LockFile): LockCounts {
  return {
    rejected_terms: lock.rejected_terms?.length ?? 0,
    merged: lock.duplicates?.merged?.length ?? 0,
    separated: lock.duplicates?.separated?.length ?? 0,
  };
}
