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

type SourceFiles = ReadonlyMap<string, ReadonlySet<string>>;

interface OtherSource {
  source: string;
  /** Path relative to the root of that source. */
  rest: string;
  sourceFiles: ReadonlySet<string>;
}

type Located =
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

function inSource(source: string, path: string, anchor: string | undefined): Located {
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

function locate(
  target: string,
  from: LinkableEntity["source"],
  files: SourceFiles,
  crossSource: boolean,
): Located {
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

/**
 * Markdown links are the strongest relation the tool knows: every link written in a note gives a
 * link at the confidence of `explicit_link`, with the file, the line and the text as provenance. A
 * link to another note is `related` until the relation typing step names it from the type pair; a
 * link to a non-markdown file is `documents`, from the resource to the note.
 */
export function explicitLinks(input: ExplicitLinksInput): ExplicitLinksResult {
  const confidence = input.profile.confidence.explicit_link ?? 1;
  const crossSource = input.inference?.cross_source_links ?? false;
  const files = new Map<string, Set<string>>();
  for (const resource of input.resources) {
    const paths = files.get(resource.source) ?? new Set<string>();
    paths.add(resource.path);
    files.set(resource.source, paths);
  }
  const entities = new Map(
    input.entities.map((entity) => [fileKey(entity.source.name, entity.source.path), entity]),
  );
  const merged = new Map<string, Link>();
  const findings: Finding[] = [];

  const record = (from: string, to: string, relation: string, provenance: Provenance): void => {
    const key = `${from} ${to} ${relation}`;
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, { from, to, relation, attributes: {}, confidence, provenance: [provenance] });
    } else {
      // Several links to the same target keep every provenance; combining their confidences is a later step.
      existing.provenance.push(provenance);
    }
  };

  for (const [key, document] of input.documents) {
    const entity = entities.get(key);
    if (entity === undefined) continue;
    for (const link of document.links) {
      const target = locate(link.target, entity.source, files, crossSource);
      if (target.kind !== "file") {
        if (target.kind === "denied") {
          findings.push(crossSourceLink(entity, link, target.source));
        } else if (target.kind === "missing") {
          findings.push(brokenLink(entity, link));
        }
        continue;
      }
      const provenance: Provenance = {
        method: "explicit_link",
        confidence,
        path: entity.source.path,
        line: link.line,
        text: link.text,
        ...anchorOf(target.anchor),
      };
      if (!target.path.endsWith(".md")) {
        // The resource entities are named from their path alone, so the same derivation finds them.
        const resource = identifierFor({
          source: target.source,
          path: target.path,
          typeSuffixes: [],
        }).id;
        record(resource, entity.id, "documents", provenance);
        continue;
      }
      const to = entities.get(fileKey(target.source, target.path));
      if (to === undefined || to.id === entity.id) continue;
      // A written link says that two notes are related, not how: the relation typing step names it.
      record(entity.id, to.id, "related", provenance);
    }
  }

  const links = [...merged.values()].sort(compareLinks);
  for (const link of links) link.provenance.sort(compareProvenances);
  return { links, findings: findings.sort(compareFindings) };
}
