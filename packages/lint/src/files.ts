import {
  repositoryFiles,
  type Config,
  type FileSystem,
  type LintOverrides,
} from "@concordance-wiki/core";

export interface LintedFilesInput {
  /** Absolute path of the repository. */
  root: string;
  fs: FileSystem;
  /** The wiki configuration; its `privacy.exclude` applies. */
  config?: Config;
  /** The content of `concordance-lint.yaml`; its `exclude` applies. */
  overrides?: LintOverrides;
  /** Whether the ignore files of the repository apply; they do unless this is false. */
  gitignore?: boolean;
}

/**
 * The files every scope of the linter reads: everything under the root but `privacy.exclude`
 * of the wiki, `exclude` of the repository's own lint configuration and, unless disabled, what
 * git ignores. The build lists the same files when it reads the repository as a source.
 */
export function lintedFiles(input: LintedFilesInput): string[] {
  return repositoryFiles({
    fs: input.fs,
    root: input.root,
    exclude: [...(input.config?.privacy?.exclude ?? []), ...(input.overrides?.exclude ?? [])],
    ...(input.gitignore === undefined ? {} : { gitignore: input.gitignore }),
  });
}
