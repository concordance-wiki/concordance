import { posix } from "node:path";

import { createRegistry, type StepFinding } from "@concordance-wiki/checks";
import {
  compileGlobs,
  identifierFor,
  resolveDuplicates,
  type Config,
  type FileSystem,
  type Finding,
  type Identified,
  type SourceConfig,
} from "@concordance-wiki/core";
import { readMarkdown, resolveLink, type ParsedMarkdown } from "@concordance-wiki/ingest";

import { readLintOverrides } from "./overrides.js";

/** Identifier prefix of a repository linted without a declared source. */
export const DEFAULT_SOURCE_NAME = "repo";

export interface LintRepositoryInput {
  /** Absolute path of the repository to check. */
  root: string;
  /** The source this repository is declared as; its rules give the type suffixes stripped from identifiers. */
  source?: SourceConfig;
  /** The wiki configuration; `privacy.exclude` and `checks` apply before the repository's own overrides. */
  config?: Config;
  fs: FileSystem;
}

function typeSuffixes(source: SourceConfig | undefined): string[] {
  return (source?.rules ?? [])
    .flatMap((rule) => (rule.match.suffix === undefined ? [] : [rule.match.suffix]))
    .sort();
}

/** A target that climbs above the repository may exist in another source; only the global mode can tell. */
function leavesRoot(path: string): boolean {
  return path === ".." || path.startsWith("../");
}

function brokenLinks(
  document: ParsedMarkdown,
  path: string,
  files: ReadonlySet<string>,
  source: string,
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
      message: `link "${link.target}" in ${path} points to ${resolved.path}, which does not exist`,
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
  const excluded = compileGlobs(input.config?.privacy?.exclude ?? []);
  const overrides = { ...input.config?.checks, ...readLintOverrides(fs, root) };
  const suffixes = typeSuffixes(input.source);
  const files = fs.listFiles(root).filter((path) => !excluded(path));
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
    findings.push(...brokenLinks(document, path, fileSet, source));
  }
  findings.push(...resolveDuplicates(identified).findings);
  return createRegistry().enrich(findings, overrides);
}
