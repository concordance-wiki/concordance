import type { FileSystem } from "../io/file-system.js";
import { readGitignore } from "./gitignore.js";
import { compileGlobs } from "./index.js";

export interface RepositoryFilesInput {
  fs: FileSystem;
  /** Absolute path of the repository. */
  root: string;
  /** Globs, relative to the root, of the files never read: `privacy.exclude` of the wiki and `exclude` of the repository's own lint configuration together. */
  exclude?: readonly string[];
  /** Whether the ignore files of the repository apply; they do unless this is false. */
  gitignore?: boolean;
}

/**
 * The files of a repository the tool reads, sorted: everything under the root but the excluded
 * globs and, unless `gitignore` is false, what git ignores. An excluded file is never read, not
 * even an ignore file.
 */
export function repositoryFiles(input: RepositoryFilesInput): string[] {
  const excluded = compileGlobs(input.exclude ?? []);
  const kept = input.fs.listFiles(input.root).filter((path) => !excluded(path));
  if (input.gitignore === false) return kept;
  const ignored = readGitignore(input.fs, input.root, kept);
  return kept.filter((path) => !ignored(path));
}
