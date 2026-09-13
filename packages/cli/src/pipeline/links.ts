import type { Config, Entity, Finding, Link } from "@concordance-wiki/core";
import {
  accumulateCooccurrences,
  cooccurrenceLinks,
  explicitLinks,
  frontmatterLinks,
  mentionLinks,
  neighbourhoodOptions,
  type Neighbourhood,
  type SourceResource,
} from "@concordance-wiki/inference";
import type { IngestedSource, ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Occurrence } from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

export interface ProduceLinksInput {
  entities: readonly Entity[];
  sources: readonly IngestedSource[];
  /** Parsed notes keyed by `<source name>/<path>`. */
  documents: ReadonlyMap<string, ParsedMarkdown>;
  occurrences: readonly Occurrence[];
  profile: Profile;
  config: Config;
}

/** The links of every producer, before combination, with what the producers reported. */
export interface ProducedLinks {
  links: Link[];
  neighbourhood: Neighbourhood;
  findings: Finding[];
}

/** Every ingested file of every source, markdown or not: what a written link may point at. */
export function sourceResources(sources: readonly IngestedSource[]): SourceResource[] {
  return sources.flatMap((source) =>
    source.files.map((file) => ({ source: source.name, path: file.path })),
  );
}

/**
 * Runs the four producers in the order of the specification: written links, frontmatter
 * references, mentions in sections and prose, then the co-occurrence neighbourhood. Each one
 * emits its own links; the combination step folds them afterwards.
 */
export function produceLinks(input: ProduceLinksInput): ProducedLinks {
  const { entities, profile } = input;
  const inference = input.config.inference;
  const explicit = explicitLinks({
    entities,
    resources: sourceResources(input.sources),
    documents: input.documents,
    profile,
    ...(inference === undefined ? {} : { inference }),
  });
  const frontmatter = frontmatterLinks({ entities, profile });
  const mentions = mentionLinks({ occurrences: input.occurrences, entities, profile });
  const neighbourhood = accumulateCooccurrences(input.occurrences, neighbourhoodOptions(inference));
  const cooccurrence = cooccurrenceLinks(neighbourhood, { profile });
  return {
    links: [...explicit.links, ...frontmatter.links, ...mentions.links, ...cooccurrence],
    neighbourhood,
    findings: [...explicit.findings, ...frontmatter.findings],
  };
}
