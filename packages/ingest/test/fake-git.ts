import type { FileHistory, GitClient, MemoryFileSystem } from "@concordance-wiki/core";

export interface FakeFile {
  content: string;
  /** Absent for an untracked file: git knows nothing about it. */
  history?: FileHistory;
  /** File system date, for untracked files. */
  modifiedAt?: string;
}

export interface FakeRepository {
  commit: string;
  files: Record<string, FakeFile>;
}

export type GitOperation = "clone" | "update" | "head" | "history" | "localHistory";

/** Git wrappers can reject with anything; ingestion must describe non-Error reasons too. */
function rejected<T>(reason: unknown): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- non-Error rejections are the point of this fake
  return Promise.reject(reason);
}

/**
 * A git client over an in-memory file system: cloning materialises the remote's files into the
 * clone directory, and any operation can be made to fail for a given url or directory.
 */
export class FakeGit implements GitClient {
  readonly calls: string[] = [];
  private readonly failures = new Map<string, unknown>();
  private readonly checkouts = new Map<string, FakeRepository>();

  /** The history of the local folders inside a repository, by folder; a folder absent here is outside any. */
  readonly local = new Map<string, Map<string, FileHistory>>();

  constructor(
    private readonly fs: MemoryFileSystem,
    private readonly remotes: Record<string, FakeRepository> = {},
  ) {}

  /** Makes `operation` reject with `error` when called with `key` (a url for clone, a directory otherwise). */
  fail(operation: GitOperation, key: string, error: unknown): void {
    this.failures.set(`${operation} ${key}`, error);
  }

  /** Registers a repository already present in `directory`, as a previous build would have left it. */
  cached(directory: string, repository: FakeRepository): void {
    this.materialise(directory, repository);
  }

  clone(url: string, ref: string, directory: string): Promise<void> {
    this.calls.push(`clone ${url} ${ref} ${directory}`);
    const remote = this.remotes[url];
    const error = this.failures.get(`clone ${url}`);
    if (error !== undefined || remote === undefined) {
      return rejected(error ?? new Error(`fatal: repository '${url}' not found`));
    }
    this.materialise(directory, remote);
    return Promise.resolve();
  }

  update(directory: string, ref: string): Promise<void> {
    this.calls.push(`update ${directory} ${ref}`);
    return this.rejectOr("update", directory, undefined);
  }

  head(directory: string): Promise<string> {
    this.calls.push(`head ${directory}`);
    return this.rejectOr("head", directory, this.checkout(directory).commit);
  }

  history(directory: string): Promise<Map<string, FileHistory>> {
    this.calls.push(`history ${directory}`);
    const entries = Object.entries(this.checkout(directory).files).flatMap(
      ([path, file]): [string, FileHistory][] =>
        file.history === undefined ? [] : [[path, file.history]],
    );
    return this.rejectOr("history", directory, new Map(entries));
  }

  localHistory(directory: string): Promise<Map<string, FileHistory> | undefined> {
    this.calls.push(`localHistory ${directory}`);
    return this.rejectOr("localHistory", directory, this.local.get(directory));
  }

  private materialise(directory: string, repository: FakeRepository): void {
    this.checkouts.set(directory, repository);
    for (const [path, file] of Object.entries(repository.files)) {
      this.fs.writeText(`${directory}/${path}`, file.content);
      if (file.modifiedAt !== undefined) {
        this.fs.dates.set(`${directory}/${path}`, file.modifiedAt);
      }
    }
  }

  private checkout(directory: string): FakeRepository {
    const repository = this.checkouts.get(directory);
    if (repository === undefined) {
      throw new Error(`fatal: not a git repository: '${directory}'`);
    }
    return repository;
  }

  private rejectOr<T>(operation: GitOperation, directory: string, value: T): Promise<T> {
    const error = this.failures.get(`${operation} ${directory}`);
    return error === undefined ? Promise.resolve(value) : rejected(error);
  }
}
