import type { ConfigIssue, Locale } from "@concordance-wiki/core";

export interface Label {
  en: string;
  fr?: string;
}

export type AttributeType =
  | "string"
  | "string[]"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "ref"
  | "ref[]"
  | "list";

export interface AttributeDefinition {
  type: AttributeType;
  values?: string[];
  default?: unknown;
  /** A type slug, `any` or `same`, or a list of type slugs. */
  target?: string | string[];
  relation?: string;
  inverse?: boolean;
  attributes?: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

export type SectionParse = "ordered-list" | "bullet-list" | "paragraphs" | "table";

export interface SectionDefinition {
  heading: Label;
  parse: SectionParse;
  produces: string;
  inverse?: boolean;
  attributes?: Record<string, unknown>;
}

export type ProfileStatus = "active" | "planned";

export interface DisplayDefinition {
  highlight?: string[];
  neighbours_order?: string[];
}

export interface TypeDefinition {
  label: Label;
  group: string;
  status?: ProfileStatus;
  glyph?: string;
  graph?: "full" | "documents-only";
  attributes?: Record<string, AttributeDefinition>;
  sections?: Record<string, SectionDefinition>;
  display?: DisplayDefinition;
}

export interface GroupDefinition {
  label: Label;
}

/** Each end is a type slug, `any`, `same` (both ends equal) or `type` (the target is a type, not an entity). */
export type AllowedPair = [string, string];

export interface RelationDefinition {
  label: Label;
  /** How the relation reads from its target; undirected relations have none. */
  inverse_label?: Label;
  directed: boolean;
  status?: ProfileStatus;
  cap?: number;
  target_kind?: "entity" | "type";
  attributes?: Record<string, AttributeDefinition>;
  allowed: AllowedPair[];
}

export interface GlossaryOccurrenceScale {
  base: number;
  per_occurrence: number;
  cap: number;
  homonym_factor?: number;
  type_prefix_bonus?: number;
}

export interface ConfidenceScale {
  explicit_link?: number;
  lock_promoted?: number;
  contract_import?: number;
  frontmatter_ref?: number;
  folder_zone?: number;
  section_mention?: number;
  glossary_occurrence?: GlossaryOccurrenceScale;
  cooccurrence?: number;
  embedding?: number;
}

export type TypePrefixes = Partial<Record<Locale, Record<string, string[]>>>;

export interface Profile {
  profile?: string;
  version: 1;
  groups?: Record<string, GroupDefinition>;
  common_attributes?: Record<string, AttributeDefinition>;
  types: Record<string, TypeDefinition>;
  relations: Record<string, RelationDefinition>;
  confidence: ConfidenceScale;
  type_prefixes?: TypePrefixes;
}

/** Every key optional at every depth; arrays stay whole because a merge replaces them. */
export type DeepPartial<T> = T extends unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type PartialProfile = DeepPartial<Profile>;

export type ProfileIssue = ConfigIssue;

export type ProfileValidation =
  { ok: true; profile: Profile; issues: ProfileIssue[] } | { ok: false; issues: ProfileIssue[] };

export type ProfileResolution =
  | { ok: true; profile: Profile; fingerprint: string; issues: ProfileIssue[] }
  | { ok: false; issues: ProfileIssue[] };
