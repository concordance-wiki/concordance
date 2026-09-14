import {
  identifierFor,
  type ApplicationConfig,
  type Entity,
  type EntitySource,
  type Finding,
  type SourceConfig,
} from "@concordance-wiki/core";
import type { IngestedFile, IngestedSource } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

import { resolveApplication } from "./application.js";
import { resolveType } from "./cascade.js";
import { resolveDomain, type DomainMatcher } from "./domains.js";
import { filingFindings } from "./filing.js";

/** A file of a source that is not a note: what its reader knows about it, before it becomes an entity. */
export interface Resource {
  /** Lowercase extension without its dot: `pptx`, `pdf`, `vtt`. */
  format: string;
  /** The native properties its reader reports (title, author, dates, counts); empty without a reader. */
  metadata: Record<string, unknown>;
}

export interface BuildResourceEntityInput {
  file: IngestedFile;
  source: IngestedSource;
  sourceConfig: SourceConfig;
  resource: Resource;
  profile: Profile;
  applications: readonly ApplicationConfig[];
  domains: DomainMatcher;
}

export interface BuiltResourceEntity {
  entity: Entity;
  findings: Finding[];
}

/** Metadata keys that do not become attributes: the title names the entity, the producing application is renamed. */
const RENAMED: Readonly<Record<string, string | undefined>> = {
  title: undefined,
  application: "producer",
};

const DEFAULT_STATUS = "valid";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function fileTitle(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.[^.]+$/, "");
}

function titleOf(metadata: Record<string, unknown>, path: string): string {
  const title = metadata["title"];
  return typeof title === "string" && title.trim() !== "" ? title.trim() : fileTitle(path);
}

function statusOf(profile: Profile): string {
  const fallback = profile.common_attributes?.["status"]?.default;
  return typeof fallback === "string" ? fallback : DEFAULT_STATUS;
}

/**
 * The attributes of a resource: the defaults of the matching rules, the metadata of the reader
 * under their own keys, the format, and `date` set from the document's own dates so that the
 * highlight of the `document` type has something to show; keys sorted.
 */
export function resourceAttributes(
  resource: Resource,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { format: resource.format };
  for (const [key, value] of Object.entries(defaults)) {
    if (key !== "application") merged[key] = value;
  }
  for (const [key, value] of Object.entries(resource.metadata)) {
    const name = key in RENAMED ? RENAMED[key] : key;
    if (name !== undefined) merged[name] = value;
  }
  const date = resource.metadata["modified"] ?? resource.metadata["created"];
  if (merged["date"] === undefined && typeof date === "string") merged["date"] = date;
  const attributes: Record<string, unknown> = {};
  for (const key of Object.keys(merged).sort(byCodeUnit)) {
    attributes[key] = merged[key];
  }
  return attributes;
}

function sourceOf(file: IngestedFile, source: IngestedSource): EntitySource {
  const location: EntitySource = {
    name: source.name,
    path: file.path,
    line: 1,
    last_modified: file.modifiedAt,
  };
  return file.commit === undefined ? location : { ...location, commit: file.commit };
}

/**
 * One entity per resource, typed by the same cascade as a note without a frontmatter (the
 * source's types, then its rules, `ext` matches included), filed under the source's application
 * and the domain of its path. Its identifier keeps the extension, so that a deck and the note
 * that shares its base name stay two entities until the twin reconciliation joins them.
 */
export function buildResourceEntity(input: BuildResourceEntityInput): BuiltResourceEntity {
  const { file, source, sourceConfig, resource, profile, applications, domains } = input;
  const identifier = identifierFor({ source: source.name, path: file.path, typeSuffixes: [] });
  const id = `${identifier.id}.${resource.format}`;
  const resolved = resolveType({ source: sourceConfig, path: file.path, frontmatter: {}, profile });
  const application = resolveApplication({
    source: sourceConfig,
    ruleDefaults: resolved.defaults,
    frontmatterApplication: undefined,
    applications,
  });
  const domain = resolveDomain(file.path, undefined, domains);
  const entity: Entity = {
    id,
    type: resolved.type,
    title: titleOf(resource.metadata, file.path),
    aliases: [],
    locale: source.locale,
    ...(application.application === undefined ? {} : { application: application.application }),
    domain: domain.domain,
    domain_origin: domain.origin,
    status: statusOf(profile),
    type_origin: resolved.origin,
    graph: profile.types[resolved.type]?.graph ?? "full",
    attributes: resourceAttributes(resource, resolved.defaults),
    source: sourceOf(file, source),
  };
  return {
    entity,
    findings: [
      ...resolved.findings,
      ...filingFindings({
        id,
        type: resolved.type,
        source: source.name,
        path: file.path,
        profile,
        application,
        domain,
      }),
    ],
  };
}
