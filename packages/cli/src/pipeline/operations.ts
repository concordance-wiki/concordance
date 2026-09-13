import type { Entity, Finding, Link } from "@concordance-wiki/core";
import { attachOperations } from "@concordance-wiki/inference";
import { languagePack } from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

export interface AttachOperationNotesInput {
  entities: readonly Entity[];
  /** The links of the plugin sources: the `exposes` links point the notes at their operations. */
  links: readonly Link[];
  profile: Profile;
  /** Locale of the project, whose pack normalises the titles compared on the last matching rung. */
  locale: string;
}

export interface AttachOperationNotesOutput {
  entities: Entity[];
  links: Link[];
  findings: Finding[];
}

/** Hand-written operation notes absorb the imported operations they describe; the rest is unchanged. */
export function attachOperationNotes(input: AttachOperationNotesInput): AttachOperationNotesOutput {
  const { normalize } = languagePack(input.locale);
  return attachOperations({
    entities: input.entities,
    links: input.links,
    profile: input.profile,
    normalize,
  });
}
