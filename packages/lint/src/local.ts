import { posix } from "node:path";

import { createRegistry, type CheckId, type StepFinding } from "@concordance-wiki/checks";
import {
  identifierFor,
  readLintConfig,
  resolveDuplicates,
  type Config,
  type FileSystem,
  type Finding,
  type Identified,
  type SourceConfig,
} from "@concordance-wiki/core";
import { readMarkdown, resolveLink, type ParsedMarkdown } from "@concordance-wiki/ingest";

import { lintedFiles } from "./files.js";

/** Code-unit order, never the collation of the runtime: the same report on every machine. */
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Identifier prefix of a repository linted without a declared source. */
export const DEFAULT_SOURCE_NAME = "repo";

/**
 * The checks the local scope computes, sorted. The build produces the same findings for them on the
 * same repository, and more for the checks that need the whole model; a parity test holds it to that.
 */
export const LOCAL_CHECKS: readonly CheckId[] = [
  "E-ENCODING",
  "E-FM-INVALID",
  "E-ID-DUP",
  "E-ID-INVALID",
  "E-LINK-BROKEN",
];

export interface LintRepositoryInput {
  /** Absolute path of the repository to check. */
  root: string;
  /** The source this repository is declared as; its rules give the type suffixes stripped from identifiers. */
  source?: SourceConfig;
  /** The wiki configuration; `privacy.exclude` and `checks` apply before the repository's own overrides. */
  config?: Config;
  fs: FileSystem;
  /** Whether the files git ignores are left out; they are unless this is false. */
  gitignore?: boolean;
}

function typeSuffixes(source: SourceConfig | undefined): string[] {
  return (source?.rules ?? [])
    .flatMap((rule) => (rule.match.suffix === undefined ? [] : [rule.match.suffix]))
    .sort(byCodeUnit);
}

/** A target that climbs above the repository may exist in another source; only the global mode can tell. */
export function leavesRoot(path: string): boolean {
  return path === ".." || path.startsWith("../");
}

/** The same finding the build reports for the link, so that a local report is read the same way as the build log. */
function brokenLinks(
  document: ParsedMarkdown,
  path: string,
  files: ReadonlySet<string>,
  source: string,
  entity: string,
): StepFinding[] {
  const findings: StepFinding[] = [];
  for (const link of document.links) {
    const resolved = resolveLink(link.target, { path, sourceFiles: files });
    if (resolved.kind !== "missing" || leavesRoot(resolved.path)) continue;
    findings.push({
      check: "E-LINK-BROKEN",
      severity: "error",
      source,
      path,
      line: link.line,
      entity,
      message: `link "${link.target}" in ${path} points to no file of source ${source}`,
    });
  }
  return findings;
}

/**
 * Checks one repository file by file: nothing is fetched, nothing is written, and no document is kept
 * once its identifier and its findings are known.
 */
export function lintRepository(input: LintRepositoryInput): Finding[] {
  const { root, fs } = input;
  const source = input.source?.name ?? DEFAULT_SOURCE_NAME;
  const local = readLintConfig(fs, root);
  const overrides = { ...input.config?.checks, ...local.checks };
  const suffixes = typeSuffixes(input.source);
  const files = lintedFiles({ ...input, overrides: local });
  const fileSet = new Set(files);
  const findings: StepFinding[] = [];
  const identified: Identified[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    const read = readMarkdown({ fs }, posix.join(root, path), path);
    if (!read.ok) {
      findings.push({ ...read.finding, source });
      continue;
    }
    const { document } = read;
    for (const finding of document.findings) {
      findings.push({ ...finding, source });
    }
    const identity = identifierFor({
      source,
      path,
      typeSuffixes: suffixes,
      frontmatterId: document.frontmatter["id"],
    });
    if (identity.finding !== undefined) {
      findings.push(identity.finding);
    }
    identified.push({ id: identity.id, source, path });
    findings.push(...brokenLinks(document, path, fileSet, source, identity.id));
  }
  findings.push(...resolveDuplicates(identified).findings);
  return createRegistry().enrich(findings, overrides);
}
