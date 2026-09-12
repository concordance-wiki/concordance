import type { Finding, InferenceConfig, Link } from "@concordance-wiki/core";
import type { ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

/** What inference needs of a typed entity: its identifier, its type and the file it comes from. */
export interface LinkableEntity {
  id: string;
  type: string;
  source: {
    name: string;
    /** Forward-slash path relative to the source root. */
    path: string;
  };
}

/** Every ingested file of every source, markdown or not. */
export interface SourceResource {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
}

export interface ExplicitLinksInput {
  entities: readonly LinkableEntity[];
  resources: readonly SourceResource[];
  /** Parsed markdown files keyed by `<source name>/<path>`. */
  documents: ReadonlyMap<string, ParsedMarkdown>;
  profile: Profile;
  inference?: InferenceConfig;
}

export interface ExplicitLinksResult {
  links: Link[];
  findings: Finding[];
}
