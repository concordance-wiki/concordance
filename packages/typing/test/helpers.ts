import type { ApplicationConfig, DomainConfig, SourceConfig } from "@concordance-wiki/core";
import type { IngestedFile, IngestedSource, ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

export const MODIFIED_AT = "2026-03-12T10:00:00.000Z";

export function file(path: string, commit?: string): IngestedFile {
  const ingested: IngestedFile = {
    path,
    absolutePath: `/sources/specs/${path}`,
    modifiedAt: MODIFIED_AT,
  };
  return commit === undefined ? ingested : { ...ingested, commit };
}

export function source(name: string, files: IngestedFile[], locale = "en"): IngestedSource {
  return { name, locale, root: `/sources/${name}`, files };
}

export function sourceConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return { name: "specs", path: "./specs", ...overrides };
}

export function document(overrides: Partial<ParsedMarkdown> = {}): ParsedMarkdown {
  return {
    frontmatter: {},
    title: undefined,
    sections: [],
    links: [],
    images: [],
    codeBlocks: [],
    quotes: [],
    tables: [],
    paragraphs: [],
    scannable: [],
    findings: [],
    ...overrides,
  };
}

/** A profile reduced to what the cascade looks at: the declared types and the common attributes. */
export function profile(overrides: Partial<Profile> = {}, withCommon = true): Profile {
  const common: Partial<Profile> = withCommon
    ? {
        common_attributes: {
          title: { type: "string" },
          application: { type: "ref", target: "application" },
          domain: { type: "ref", target: "domain" },
          status: { type: "enum", values: ["draft", "valid"], default: "draft" },
        },
      }
    : {};
  return {
    version: 1,
    ...common,
    types: {
      document: { label: { en: "Document" }, group: "source", graph: "documents-only" },
      meeting: { label: { en: "Meeting" }, group: "source", graph: "documents-only" },
      screen: {
        label: { en: "Screen" },
        group: "application",
        attributes: { url_pattern: { type: "string" }, roles: { type: "ref[]" } },
      },
      rule: { label: { en: "Rule" }, group: "business" },
      application: { label: { en: "Application" }, group: "container" },
      domain: { label: { en: "Domain" }, group: "container" },
    },
    relations: {},
    confidence: {},
    ...overrides,
  };
}

export const APPLICATIONS: ApplicationConfig[] = [
  { id: "policy-admin", title: "Policy administration", status: "active" },
  { id: "billing" },
];

/** A root domain with a subdomain, and a second root whose globs overlap the first. */
export const DOMAINS: DomainConfig[] = [
  {
    id: "membership",
    match: ["**/*member*"],
    subdomains: [{ id: "payments", match: ["**/*payment*", "**/member-payments/**"] }],
  },
  { id: "contracts", match: ["contracts/**"] },
];
