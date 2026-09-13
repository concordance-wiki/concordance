/** Last change known to git for one file of a repository. */
export interface FileHistory {
  commit: string;
  /** ISO 8601 committer date. */
  modifiedAt: string;
}

/** The git operations ingestion needs. Every method writes the cache directory only, never a source. */
export interface GitClient {
  /**
   * Clones `url` at `ref` into `directory`, which must not exist yet: the whole history without
   * the blobs, so that the dates come from the commits and only the files read are fetched.
   */
  clone(url: string, ref: string, directory: string): Promise<void>;
  /** Brings an existing clone to the current tip of `ref`, its history completed when it was shallow. */
  update(directory: string, ref: string): Promise<void>;
  /** The commit checked out in `directory`. */
  head(directory: string): Promise<string>;
  /** Last commit and date per tracked file, paths relative to the repository root with forward slashes. */
  history(directory: string): Promise<Map<string, FileHistory>>;
  /**
   * The history of the files under a local folder inside a repository, paths relative to the
   * folder: the last commit and date of every tracked file whose working tree matches the head;
   * a file modified, added or untracked is left out, and so is a folder outside any repository
   * or in one without a commit, which read as `undefined`. A client without it knows nothing of
   * local folders, whose files then carry their file system date.
   */
  localHistory?(directory: string): Promise<Map<string, FileHistory> | undefined>;
}
