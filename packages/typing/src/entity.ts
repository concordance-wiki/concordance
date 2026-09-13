import {
  identifierFor,
  type ApplicationConfig,
  type Entity,
  type EntitySource,
  type Finding,
  type SourceConfig,
} from "@concordance-wiki/core";
import type { IngestedFile, IngestedSource, ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

import { resolveApplication } from "./application.js";
import { resolveType } from "./cascade.js";
import { resolveDomain, type DomainMatcher } from "./domains.js";
import { filingFindings } from "./filing.js";

export interface BuildEntityInput {
  file: IngestedFile;
  source: IngestedSource;
  sourceConfig: SourceConfig;
  document: ParsedMarkdown;
  profile: Profile;
  applications: readonly ApplicationConfig[];
  domains: DomainMatcher;
}

export interface BuiltEntity {
  entity: Entity;
  findings: Finding[];
}

/** Frontmatter keys that become fields of the entity rather than attributes. */
const COMMON_KEYS = new Set([
  "id",
  "type",
  "title",
  "aliases",
  "status",
  "summary",
  "tags",
  "application",
  "domain",
]);

const DEFAULT_STATUS = "valid";

export function typeSuffixesOf(source: SourceConfig): string[] {
  return (source.rules ?? []).flatMap((rule) =>
    rule.match.suffix === undefined ? [] : [rule.match.suffix],
  );
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function fileTitle(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.[^.]+$/, "");
}

function titleOf(
  frontmatter: Record<string, unknown>,
  document: ParsedMarkdown,
  path: string,
): string {
  if (typeof frontmatter["title"] === "string") return frontmatter["title"];
  return document.title ?? fileTitle(path);
}

function aliasesOf(frontmatter: Record<string, unknown>): string[] {
  const { aliases } = frontmatter;
  if (!Array.isArray(aliases)) return [];
  return aliases.filter((alias): alias is string => typeof alias === "string");
}

function statusOf(frontmatter: Record<string, unknown>, profile: Profile): string {
  if (typeof frontmatter["status"] === "string") return frontmatter["status"];
  const fallback = profile.common_attributes?.["status"]?.default;
  return typeof fallback === "string" ? fallback : DEFAULT_STATUS;
}

function summaryOf(
  frontmatter: Record<string, unknown>,
  document: ParsedMarkdown,
): string | undefined {
  if (typeof frontmatter["summary"] === "string") return frontmatter["summary"];
  return document.paragraphs[0]?.text;
}

function attributesOf(
  frontmatter: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  // A rule's application feeds the application cascade, not the attributes.
  for (const [key, value] of Object.entries(defaults)) {
    if (key !== "application") merged[key] = value;
  }
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!COMMON_KEYS.has(key)) merged[key] = value;
  }
  const attributes: Record<string, unknown> = {};
  for (const key of Object.keys(merged).sort(byCodeUnit)) {
    attributes[key] = merged[key];
  }
  return attributes;
}

function sourceOf(file: IngestedFile, source: IngestedSource): EntitySource {
  // A note is the whole file: its first line locates it.
  const location: EntitySource = {
    name: source.name,
    path: file.path,
    line: 1,
    last_modified: file.modifiedAt,
  };
  return file.commit === undefined ? location : { ...location, commit: file.commit };
}

function unknownAttributes(input: BuildEntityInput, type: string, id: string): Finding[] {
  const { profile } = input;
  const known = new Set([
    "id",
    "type",
    ...Object.keys(profile.common_attributes ?? {}),
    ...Object.keys(profile.types[type]?.attributes ?? {}),
  ]);
  return Object.keys(input.document.frontmatter)
    .filter((key) => !known.has(key))
    .map((key): Finding => ({
      check: "W-ATTRIBUTE-UNKNOWN",
      severity: "warning",
      source: input.source.name,
      path: input.file.path,
      entity: id,
      message: `frontmatter attribute "${key}" of ${input.file.path} is not declared for type ${type}; it is kept as-is`,
      remediation:
        "Use an attribute of the type, declare it in the project profile, or remove the key.",
    }));
}

export function buildEntity(input: BuildEntityInput): BuiltEntity {
  const { file, source, sourceConfig, document, profile, applications, domains } = input;
  const { frontmatter } = document;
  const identifier = identifierFor({
    source: source.name,
    path: file.path,
    typeSuffixes: typeSuffixesOf(sourceConfig),
    frontmatterId: frontmatter["id"],
  });
  const resolved = resolveType({ source: sourceConfig, path: file.path, frontmatter, profile });
  const application = resolveApplication({
    source: sourceConfig,
    ruleDefaults: resolved.defaults,
    frontmatterApplication: frontmatter["application"],
    applications,
  });
  const domain = resolveDomain(file.path, frontmatter["domain"], domains);
  const entity: Entity = {
    id: identifier.id,
    type: resolved.type,
    title: titleOf(frontmatter, document, file.path),
    aliases: aliasesOf(frontmatter),
    locale: source.locale,
    ...(application.application === undefined ? {} : { application: application.application }),
    domain: domain.domain,
    status: statusOf(frontmatter, profile),
    type_origin: resolved.origin,
    graph: profile.types[resolved.type]?.graph ?? "full",
    attributes: attributesOf(frontmatter, resolved.defaults),
    source: sourceOf(file, source),
  };
  const summary = summaryOf(frontmatter, document);
  if (summary !== undefined) entity.summary = summary;
  const findings = [
    ...(identifier.finding === undefined ? [] : [identifier.finding]),
    ...resolved.findings,
    ...unknownAttributes(input, resolved.type, identifier.id),
    ...filingFindings({
      id: identifier.id,
      type: resolved.type,
      source: source.name,
      path: file.path,
      profile,
      application,
      domain,
    }),
  ];
  return { entity, findings };
}
