import type { Finding } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

/** Where an entity comes from: the declared source name and the file path inside it. */
export interface CheckEntitySource {
  name: string;
  path: string;
}

export interface CheckEntity {
  id: string;
  type: string;
  source: CheckEntitySource;
  attributes: Record<string, unknown>;
}

/** Where a link was read: the method, and the path and line in the note that carries it. */
export interface CheckProvenance {
  method: string;
  /** Forward-slash path relative to the source root of the note the link was read in. */
  path?: string;
  line?: number;
}

export interface CheckLink {
  from: string;
  to: string;
  relation: string;
  /** Absent when the caller has no provenance to give; every provenance then counts as a citation. */
  provenance?: readonly CheckProvenance[];
}

export interface CheckSource {
  name: string;
  files: readonly string[];
}

/** The model a check reads; a structural view that later stories grow without changing the checks. */
export interface CheckInput {
  entities: readonly CheckEntity[];
  links: readonly CheckLink[];
  sources: readonly CheckSource[];
  profile: Profile;
}

/** A check is pure: same input, same findings, no effect. */
export type Check = (input: CheckInput) => Finding[];
