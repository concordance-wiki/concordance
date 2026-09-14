import { join, resolve } from "node:path";

import {
  compareFindings,
  LINT_CONFIG_FILE,
  LintConfigError,
  readLintConfig,
  repositoryFiles,
  type Config,
  type FileHistory,
  type Finding,
  type Locale,
  type SourceConfig,
} from "@concordance-wiki/core";

import type { IngestDependencies, IngestedFile, IngestedSource, IngestResult } from "./types.js";

const DEFAULT_REF = "main";

type Outcome = { source: IngestedSource } | { finding: Finding };

const credentialFailure =
  /Authentication failed|could not read Username|Permission denied|terminal prompts disabled/;

function unreachable(name: string, message: string): Finding {
  const credentials = credentialFailure.test(message);
  return {
    check: "W-SOURCE-UNREACHABLE",
    severity: "warning",
    source: name,
    message: credentials
      ? `${message}; the pipeline has no credentials for this repository`
      : message,
    remediation: credentials
      ? "Give the pipeline read access to the repository through git (credential helper, token in the URL rewrite or deploy key); the source is skipped in this build."
      : "Check the URL, the ref and the credentials of the pipeline; the source is skipped in this build.",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Code unit order, the order `FileSystem.listFiles` promises, independent of any locale. */
function byPath(a: IngestedFile, b: IngestedFile): number {
  return Number(a.path > b.path) - Number(a.path < b.path);
}

/**
 * Lists the files kept under `root`, the ones the linter reads in that repository: `privacy.exclude`
 * of the wiki, `exclude` of the repository's own lint configuration and its ignore files are applied
 * before any file is stamped or read. A faulty lint configuration stops the linter; here it throws
 * a `LintConfigError` the caller turns into a finding.
 */
function keptFiles(deps: IngestDependencies, root: string, excluded: readonly string[]): string[] {
  const local = readLintConfig(deps.fs, root);
  return repositoryFiles({
    fs: deps.fs,
    root,
    exclude: [...excluded, ...(local.exclude ?? [])],
  });
}

/** The source cannot be read consistently with its linter: it is skipped, like one that cannot be fetched. */
function unreadable(name: string, error: LintConfigError): Finding {
  return {
    check: "W-SOURCE-UNREACHABLE",
    severity: "warning",
    source: name,
    message: `source "${name}" could not be read: ${error.message}`,
    remediation: `Fix ${LINT_CONFIG_FILE} in the repository, as concordance lint reports it; the source is skipped in this build.`,
  };
}

async function ingestGit(
  source: SourceConfig,
  url: string,
  locale: Locale,
  excluded: readonly string[],
  deps: IngestDependencies,
): Promise<Outcome> {
  const ref = source.ref ?? DEFAULT_REF;
  const root = join(deps.cacheDirectory, "sources", source.name);
  try {
    if (deps.fs.exists(root)) {
      await deps.git.update(root, ref);
    } else {
      await deps.git.clone(url, ref, root);
    }
    const commit = await deps.git.head(root);
    const history = await deps.git.history(root);
    const files = keptFiles(deps, root, excluded).map((path): IngestedFile => {
      const absolutePath = join(root, path);
      // An untracked file has no history: it belongs to the checked-out commit as far as the build knows.
      const known = history.get(path) ?? { commit, modifiedAt: deps.fs.modifiedAt(absolutePath) };
      return { path, absolutePath, commit: known.commit, modifiedAt: known.modifiedAt };
    });
    return { source: { name: source.name, locale, root, commit, files: files.toSorted(byPath) } };
  } catch (error) {
    if (error instanceof LintConfigError) return { finding: unreadable(source.name, error) };
    return {
      finding: unreachable(
        source.name,
        `source "${source.name}" could not be fetched: ${errorMessage(error)}`,
      ),
    };
  }
}

/**
 * A local folder inside a repository dates its files by their last commit, like a clone; a file
 * changed since, a folder outside any repository or a client that knows nothing of local
 * folders leave the file system date.
 */
async function ingestLocal(
  source: SourceConfig,
  path: string,
  locale: Locale,
  excluded: readonly string[],
  deps: IngestDependencies,
): Promise<Outcome> {
  // The platform's resolution: a configuration under `C:\wiki` names `..\glossary` as Windows does.
  const root = resolve(deps.configDirectory, path);
  if (!deps.fs.exists(root)) {
    return {
      finding: unreachable(
        source.name,
        `source "${source.name}" could not be read: ${root} does not exist`,
      ),
    };
  }
  let kept: string[];
  try {
    kept = keptFiles(deps, root, excluded);
  } catch (error) {
    if (error instanceof LintConfigError) return { finding: unreadable(source.name, error) };
    throw error;
  }
  const history = (await deps.git.localHistory?.(root)) ?? new Map<string, FileHistory>();
  const files = kept.map((relative): IngestedFile => {
    const absolutePath = join(root, relative);
    const known = history.get(relative);
    return known === undefined
      ? { path: relative, absolutePath, modifiedAt: deps.fs.modifiedAt(absolutePath) }
      : { path: relative, absolutePath, commit: known.commit, modifiedAt: known.modifiedAt };
  });
  return { source: { name: source.name, locale, root, files: files.toSorted(byPath) } };
}

export async function ingestSources(
  config: Config,
  deps: IngestDependencies,
): Promise<IngestResult> {
  const excluded = config.privacy?.exclude ?? [];
  const sources: IngestedSource[] = [];
  const findings: Finding[] = [];
  for (const source of config.sources) {
    const locale = source.locale ?? config.project.locale ?? "en";
    let outcome: Outcome;
    if (source.kind === "tracker") {
      continue;
    } else if (source.git !== undefined) {
      outcome = await ingestGit(source, source.git, locale, excluded, deps);
    } else if (source.path !== undefined) {
      outcome = await ingestLocal(source, source.path, locale, excluded, deps);
    } else {
      // Configuration validation rejects a source with neither git nor path; nothing can be read from it.
      continue;
    }
    if ("source" in outcome) {
      sources.push(outcome.source);
    } else {
      findings.push(outcome.finding);
    }
  }
  return { sources, findings: findings.toSorted(compareFindings) };
}
