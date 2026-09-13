import { posix } from "node:path";

import {
  compareFindings,
  compileGlobs,
  type Config,
  type Finding,
  type Locale,
  type PathMatcher,
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

/** Lists the files kept under `root`; exclusions are applied before any file is stamped or read. */
function keptFiles(deps: IngestDependencies, root: string, excluded: PathMatcher): string[] {
  return deps.fs.listFiles(root).filter((path) => !excluded(path));
}

async function ingestGit(
  source: SourceConfig,
  url: string,
  locale: Locale,
  excluded: PathMatcher,
  deps: IngestDependencies,
): Promise<Outcome> {
  const ref = source.ref ?? DEFAULT_REF;
  const root = posix.join(deps.cacheDirectory, "sources", source.name);
  try {
    if (deps.fs.exists(root)) {
      await deps.git.update(root, ref);
    } else {
      await deps.git.clone(url, ref, root);
    }
    const commit = await deps.git.head(root);
    const history = await deps.git.history(root);
    const files = keptFiles(deps, root, excluded).map((path): IngestedFile => {
      const absolutePath = posix.join(root, path);
      // An untracked file has no history: it belongs to the checked-out commit as far as the build knows.
      const known = history.get(path) ?? { commit, modifiedAt: deps.fs.modifiedAt(absolutePath) };
      return { path, absolutePath, commit: known.commit, modifiedAt: known.modifiedAt };
    });
    return { source: { name: source.name, locale, root, commit, files: files.toSorted(byPath) } };
  } catch (error) {
    return {
      finding: unreachable(
        source.name,
        `source "${source.name}" could not be fetched: ${errorMessage(error)}`,
      ),
    };
  }
}

function ingestLocal(
  source: SourceConfig,
  path: string,
  locale: Locale,
  excluded: PathMatcher,
  deps: IngestDependencies,
): Outcome {
  const root = posix.resolve(deps.configDirectory, path);
  if (!deps.fs.exists(root)) {
    return {
      finding: unreachable(
        source.name,
        `source "${source.name}" could not be read: ${root} does not exist`,
      ),
    };
  }
  const files = keptFiles(deps, root, excluded).map((relative): IngestedFile => {
    const absolutePath = posix.join(root, relative);
    return { path: relative, absolutePath, modifiedAt: deps.fs.modifiedAt(absolutePath) };
  });
  return { source: { name: source.name, locale, root, files: files.toSorted(byPath) } };
}

export async function ingestSources(
  config: Config,
  deps: IngestDependencies,
): Promise<IngestResult> {
  const excluded = compileGlobs(config.privacy?.exclude ?? []);
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
      outcome = ingestLocal(source, source.path, locale, excluded, deps);
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
