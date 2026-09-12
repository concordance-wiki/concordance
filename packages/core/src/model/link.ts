/** The methods of `schemas/model.schema.json`; the confidence of each one lives in the profile. */
export type ProvenanceMethod =
  | "explicit_link"
  | "lock_promoted"
  | "contract_import"
  | "frontmatter_ref"
  | "folder_zone"
  | "section_mention"
  | "glossary_occurrence"
  | "cooccurrence"
  | "embedding";

export interface ProvenanceOccurrence {
  line: number;
  position?: number;
  context: string;
  section?: string;
}

/** Why one method claims a link; a link keeps every provenance it received. */
export interface Provenance {
  method: ProvenanceMethod;
  confidence: number;
  /** Forward-slash path relative to the source root of the entity the provenance was read from. */
  path?: string;
  line?: number;
  section?: string;
  attribute?: string;
  /** The text as written by the author, a link text or a term. */
  text?: string;
  /** The fragment of a written link, without its `#`. */
  anchor?: string;
  url?: string;
  operation?: string;
  occurrences?: ProvenanceOccurrence[];
}

export interface Link {
  from: string;
  to: string;
  relation: string;
  attributes?: Record<string, unknown>;
  confidence: number;
  provenance: Provenance[];
}
