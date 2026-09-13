import {
  compareFindings,
  compareLinks,
  compareProvenances,
  identifierFor,
  type Finding,
  type Link,
  type Provenance,
} from "@concordance-wiki/core";
import { resolveLink, type MarkdownLink } from "@concordance-wiki/ingest";

import type { ExplicitLinksInput, ExplicitLinksResult, LinkableEntity } from "./types.js";

/** The files of every source, by source name. */
export type SourceFiles = ReadonlyMap<string, ReadonlySet<string>>;

interface OtherSource {
  source: string;
  /** Path relative to the root of that source. */
  rest: string;
  sourceFiles: ReadonlySet<string>;
}

/** Where a written link lands: a file of a source, another source when cross-source links are off, nothing, or the web. */
export type LocatedLink =
  | { kind: "external" }
  | { kind: "denied"; source: string }
  | { kind: "missing" }
  | { kind: "file"; source: string; path: string; anchor?: string };

const NO_FILES: ReadonlySet<string> = new Set();

function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

function anchorOf(anchor: string | undefined): { anchor?: string } {
  return anchor === undefined ? {} : { anchor };
}

function inSource(source: string, path: string, anchor: string | undefined): LocatedLink {
  return { kind: "file", source, path, ...anchorOf(anchor) };
}

/** `<source>:<path>` names another source; any other prefix is a URL scheme left to `resolveLink`. */
function prefixedSource(target: string, files: SourceFiles): OtherSource | undefined {
  const colon = target.indexOf(":");
  if (colon === -1) return undefined;
  const source = target.slice(0, colon);
  const sourceFiles = files.get(source);
  return sourceFiles === undefined
    ? undefined
    : { source, rest: target.slice(colon + 1), sourceFiles };
}

/**
 * A relative link that climbs one level above the source root and lands in `<source>/<path>` reaches
 * a sibling source: the sources of one repository are often sibling folders.
 */
function siblingSource(path: string, files: SourceFiles): OtherSource | undefined {
  const [up, source, ...rest] = path.split("/");
  if (up !== ".." || source === undefined || rest.length === 0) return undefined;
  const sourceFiles = files.get(source);
  return sourceFiles === undefined ? undefined : { source, rest: rest.join("/"), sourceFiles };
}

/**
 * The file a link target reaches from a note: in its own source, in a source named as a prefix
 * or reached as a sibling folder when cross-source links are on.
 */
export function locateLink(
  target: string,
  from: Pick<LinkableEntity["source"], "name" | "path">,
  files: SourceFiles,
  crossSource: boolean,
): LocatedLink {
  const prefixed = prefixedSource(target, files);
  if (prefixed !== undefined) {
    if (!crossSource) return { kind: "denied", source: prefixed.source };
    const resolved = resolveLink(prefixed.rest, { path: "", sourceFiles: prefixed.sourceFiles });
    // An empty path resolves to the linking file, which is never a file of the other source.
    return resolved.kind === "internal" && prefixed.sourceFiles.has(resolved.path)
      ? inSource(prefixed.source, resolved.path, resolved.anchor)
      : { kind: "missing" };
  }
  const resolved = resolveLink(target, {
    path: from.path,
    sourceFiles: files.get(from.name) ?? NO_FILES,
  });
  if (resolved.kind === "external") return { kind: "external" };
  if (resolved.kind === "internal") return inSource(from.name, resolved.path, resolved.anchor);
  const sibling = siblingSource(resolved.path, files);
  if (sibling === undefined) return { kind: "missing" };
  if (!crossSource) return { kind: "denied", source: sibling.source };
  return sibling.sourceFiles.has(sibling.rest)
    ? inSource(sibling.source, sibling.rest, resolved.anchor)
    : { kind: "missing" };
}

function brokenLink(entity: LinkableEntity, link: MarkdownLink): Finding {
  return {
    check: "E-LINK-BROKEN",
    severity: "error",
    source: entity.source.name,
    path: entity.source.path,
    line: link.line,
    entity: entity.id,
    message: `link "${link.target}" in ${entity.source.path} points to no file of source ${entity.source.name}`,
    remediation:
      "Fix the path; the linter rewrites the link under --fix when exactly one file matches the old name.",
  };
}

function crossSourceLink(entity: LinkableEntity, link: MarkdownLink, source: string): Finding {
  return {
    check: "W-LINK-CROSS-SOURCE",
    severity: "warning",
    source: entity.source.name,
    path: entity.source.path,
    line: link.line,
    entity: entity.id,
    message: `link "${link.target}" in ${entity.source.path} leaves source ${entity.source.name} for source ${source}; cross-source links are disabled`,
    remediation:
      "Set inference.cross_source_links to true in concordance.yaml to resolve links across sources, or link to a note of the same source.",
  };
}

/** What the notes are looked up by, and how far a link may reach. */
interface LinkContext {
  entities: ReadonlyMap<string, LinkableEntity>;
  files: SourceFiles;
  crossSource: boolean;
  confidence: number;
}

/** What one written link yields: a finding, a link with its provenance, or nothing for an external address. */
type LinkOutcome =
  | { finding: Finding }
  | { from: string; to: string; relation: string; provenance: Provenance }
  | undefined;

function outcomeOf(entity: LinkableEntity, link: MarkdownLink, context: LinkContext): LinkOutcome {
  const target = locateLink(link.target, entity.source, context.files, context.crossSource);
  if (target.kind === "denied") return { finding: crossSourceLink(entity, link, target.source) };
  if (target.kind === "missing") return { finding: brokenLink(entity, link) };
  if (target.kind === "external") return undefined;
  const provenance: Provenance = {
    method: "explicit_link",
    confidence: context.confidence,
    path: entity.source.path,
    line: link.line,
    text: link.text,
    ...anchorOf(target.anchor),
  };
  if (!target.path.endsWith(".md")) {
    // The resource entities are named from their path alone, so the same derivation finds them.
    const resource = identifierFor({ source: target.source, path: target.path, typeSuffixes: [] });
    return { from: resource.id, to: entity.id, relation: "documents", provenance };
  }
  const to = context.entities.get(fileKey(target.source, target.path));
  if (to === undefined || to.id === entity.id) return undefined;
  // A written link says that two notes are related, not how: the relation typing step names it.
  return { from: entity.id, to: to.id, relation: "related", provenance };
}

type FoundLink = Exclude<LinkOutcome, undefined | { finding: Finding }>;

/** Several links to the same target keep every provenance; combining their confidences is a later step. */
function record(merged: Map<string, Link>, found: FoundLink, confidence: number): void {
  const { from, to, relation, provenance } = found;
  const key = `${from} ${to} ${relation}`;
  const existing = merged.get(key);
  if (existing === undefined) {
    merged.set(key, { from, to, relation, attributes: {}, confidence, provenance: [provenance] });
  } else {
    existing.provenance.push(provenance);
  }
}

/**
 * Markdown links are the strongest relation the tool knows: every link written in a note gives a
 * link at the confidence of `explicit_link`, with the file, the line and the text as provenance. A
 * link to another note is `related` until the relation typing step names it from the type pair; a
 * link to a non-markdown file is `documents`, from the resource to the note.
 */
export function explicitLinks(input: ExplicitLinksInput): ExplicitLinksResult {
  const confidence = input.profile.confidence.explicit_link ?? 1;
  const files = new Map<string, Set<string>>();
  for (const resource of input.resources) {
    const paths = files.get(resource.source) ?? new Set<string>();
    paths.add(resource.path);
    files.set(resource.source, paths);
  }
  const entities = new Map(
    input.entities.map((entity) => [fileKey(entity.source.name, entity.source.path), entity]),
  );
  const context: LinkContext = {
    entities,
    files,
    crossSource: input.inference?.cross_source_links ?? false,
    confidence,
  };
  const merged = new Map<string, Link>();
  const findings: Finding[] = [];
  for (const [key, document] of input.documents) {
    const entity = entities.get(key);
    if (entity === undefined) continue;
    for (const link of document.links) {
      const outcome = outcomeOf(entity, link, context);
      if (outcome === undefined) continue;
      if ("finding" in outcome) {
        findings.push(outcome.finding);
        continue;
      }
      record(merged, outcome, confidence);
    }
  }

  const links = [...merged.values()].sort(compareLinks);
  for (const link of links) link.provenance.sort(compareProvenances);
  return { links, findings: findings.toSorted(compareFindings) };
}
