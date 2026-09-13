import type { Config, Entity, Finding } from "@concordance-wiki/core";
import type { IngestedSource, ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";
import { typeSources } from "@concordance-wiki/typing";

export interface TypeNotesInput {
  sources: IngestedSource[];
  documents: ReadonlyMap<string, ParsedMarkdown>;
  config: Config;
  profile: Profile;
}

export interface TypedNotes {
  entities: Entity[];
  findings: Finding[];
}

/** One entity per parsed note, filed under its application and domain, identifiers resolved. */
export function typeNotes(input: TypeNotesInput): TypedNotes {
  return typeSources(input);
}
