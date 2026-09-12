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

export interface CheckLink {
  from: string;
  to: string;
  relation: string;
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
