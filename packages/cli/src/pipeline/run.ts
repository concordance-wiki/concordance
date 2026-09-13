import type { CheckRegistry } from "@concordance-wiki/checks";
import type {
  Candidates,
  Clock,
  Config,
  ContractRecord,
  DisplayedNeighbourhood,
  DuplicateCounts,
  Entity,
  FileSystem,
  Finding,
  KeywordCounts,
  Link,
  Neighbours,
  PluginRegistry,
} from "@concordance-wiki/core";
import { neighbourhoodToModel } from "@concordance-wiki/inference";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

import { enrichStepFindings, runModelChecks } from "./checks.js";
import { combineProducedLinks } from "./combine.js";
import { buildDictionaries } from "./dictionary.js";
import { displayedNeighbourhoodBlock } from "./display.js";
import { reconcileTwins } from "./duplicates.js";
import { discoverKeywords } from "./keywords.js";
import { produceLinks } from "./links.js";
import { attachOperationNotes } from "./operations.js";
import { indexDocuments, parseSources } from "./parse.js";
import { refineRelations } from "./relations.js";
import { scanNotes } from "./scan.js";
import { loadPluginSources } from "./sources.js";
import { typeNotes } from "./typing.js";

export interface PipelineInput {
  config: Config;
  profile: Profile;
  /** The folder of `concordance.yaml`. */
  configDirectory: string;
  cacheDirectory: string;
  /** What ingestion produced; the pipeline starts at parsing. */
  sources: IngestedSource[];
  /** Findings reported before the pipeline ran: ingestion and plugin loading. */
  findings: readonly Finding[];
  plugins: PluginRegistry;
  checks: CheckRegistry;
  fs: FileSystem;
  clock: Clock;
  /** Absent when the build runs without network access. */
  fetch?: typeof fetch;
}

export interface PipelineResult {
  files: number;
  entities: Entity[];
  links: Link[];
  /** Every finding of every step, enriched by the registry and in canonical order. */
  findings: Finding[];
  candidates: Candidates;
  neighbours: Neighbours;
  displayedNeighbourhood: DisplayedNeighbourhood;
  contracts: ContractRecord[];
  keywords: KeywordCounts;
  duplicates: DuplicateCounts;
}

/**
 * The inference chain, from the ingested sources to the blocks of the model, each step a pure
 * function of the previous ones: parse, type, plugin sources, operation notes, dictionary, scan,
 * links, combination, relation typing, keywords, twin resources, model checks, displayed
 * neighbourhood.
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { config, profile, sources, fs, clock } = input;
  const parsed = parseSources(sources, fs);
  const documents = indexDocuments(parsed.documents);
  const typed = typeNotes({ sources, documents, config, profile });
  const contributed = await loadPluginSources({
    providers: input.plugins.sources(),
    entities: typed.entities,
    roots: Object.fromEntries(sources.map((source) => [source.name, source.root])),
    cacheDirectory: input.cacheDirectory,
    profile,
    context: { fs, clock, ...(input.fetch === undefined ? {} : { fetch: input.fetch }) },
  });
  const attached = attachOperationNotes({
    entities: [...typed.entities, ...contributed.entities],
    links: contributed.links,
    profile,
    // The same default as the ingest step gives a source without a locale of its own.
    locale: config.project.locale ?? "en",
  });
  let entities = attached.entities;
  const dictionaries = buildDictionaries({
    entities,
    sources,
    config,
    configDirectory: input.configDirectory,
    fs,
  });
  const occurrences = scanNotes({
    documents: parsed.documents,
    sources,
    dictionaries: dictionaries.byLocale,
    profile,
    config,
  });
  const produced = produceLinks({ entities, sources, documents, occurrences, profile, config });
  const combined = combineProducedLinks([...produced.links, ...attached.links], profile);
  const refined = refineRelations(combined, { profile, entities });
  const keywords = discoverKeywords({
    documents: parsed.documents,
    sources,
    dictionaries: dictionaries.byLocale,
    config,
    profile,
  });
  entities = [...entities, ...keywords.entities];
  const twins = reconcileTwins({
    entities,
    links: refined.links,
    documents,
    sources,
    dictionaries: dictionaries.byLocale,
    config,
    profile,
    clock,
  });
  const checked = runModelChecks({
    registry: input.checks,
    entities: twins.entities,
    links: twins.links,
    sources,
    profile,
    ...(config.checks === undefined ? {} : { overrides: config.checks }),
  });
  const findings = enrichStepFindings(
    input.checks,
    [
      ...input.findings,
      ...parsed.findings,
      ...typed.findings,
      ...contributed.findings,
      ...attached.findings,
      ...dictionaries.findings,
      ...produced.findings,
      ...refined.findings,
      ...keywords.findings,
      ...twins.findings,
      ...checked,
    ],
    config.checks,
  );
  return {
    files: sources.reduce((count, source) => count + source.files.length, 0),
    entities: twins.entities,
    links: twins.links,
    findings,
    candidates: {
      terms: keywords.terms,
      ...(contributed.objects.length === 0 ? {} : { objects: contributed.objects }),
      duplicates: twins.candidates,
    },
    neighbours: neighbourhoodToModel(produced.neighbourhood),
    displayedNeighbourhood: displayedNeighbourhoodBlock({
      entities: twins.entities,
      links: twins.links,
      config,
      profile,
    }),
    contracts: contributed.contracts,
    keywords: keywords.counts,
    duplicates: twins.counts,
  };
}
