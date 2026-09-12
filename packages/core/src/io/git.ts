/** Last change known to git for one file of a repository. */
export interface FileHistory {
  commit: string;
  /** ISO 8601 committer date. */
  modifiedAt: string;
}

/** The git operations ingestion needs. Every method reads or writes the cache directory only, never a source. */
export interface GitClient {
  /** Clones `url` at `ref` with depth 1 into `directory`, which must not exist yet. */
  clone(url: string, ref: string, directory: string): Promise<void>;
  /** Brings an existing depth-1 clone to the current tip of `ref`. */
  update(directory: string, ref: string): Promise<void>;
  /** The commit checked out in `directory`. */
  head(directory: string): Promise<string>;
  /** Last commit and date per tracked file, paths relative to the repository root with forward slashes. */
  history(directory: string): Promise<Map<string, FileHistory>>;
}
