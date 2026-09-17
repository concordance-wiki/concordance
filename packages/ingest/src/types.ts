import type { FileSystem, Finding, GitClient, Locale } from "@concordance-wiki/core";

export interface IngestedFile {
  /** Forward-slash path relative to the source root. */
  path: string;
  absolutePath: string;
  /** Last commit that touched the file; absent for a local file outside a repository, or changed since its commit. */
  commit?: string;
  /** ISO 8601 date of the last change: committer date when git knows the file, file system date otherwise. */
  modifiedAt: string;
}

export interface IngestedSource {
  name: string;
  locale: Locale;
  root: string;
  /** Commit checked out for the build; absent for local sources. */
  commit?: string;
  files: IngestedFile[];
}

export interface IngestResult {
  sources: IngestedSource[];
  findings: Finding[];
}

export interface IngestDependencies {
  fs: FileSystem;
  git: GitClient;
  /** Where clones live; never a source repository. */
  cacheDirectory: string;
  /** Directory of the configuration file, against which `path` sources are resolved. */
  configDirectory: string;
  /** Where the build writes; a local source holding it never reads it back. */
  outputDirectory?: string;
}
