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
import { neighbourhoodOptions, neighbourhoodToModel } from "@concordance-wiki/inference";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

import { enrichStepFindings, runModelChecks } from "./checks.js";
import { combineProducedLinks } from "./combine.js";
import { keywordNeighbours } from "./companions.js";
import { buildDictionaries } from "./dictionary.js";
import { displayedNeighbourhoodBlock } from "./display.js";
import {
  documentsWithoutMarkdown,
  readDocuments,
  resourcesOf,
  type ReadDocument,
} from "./documents.js";
import { reconcileTwins } from "./duplicates.js";
import { discoverKeywords, type KeywordLead } from "./keywords.js";
import { produceLinks } from "./links.js";
import { attachOperationNotes } from "./operations.js";
import { indexDocuments, parseSources } from "./parse.js";
import { loadPseudonymization, pseudonymizeScope, pseudonymizeTranscripts } from "./privacy.js";
import { recognisedWords, type RecognisedWord } from "./recognised.js";
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
  /** How many documents are converted at a time; one when unset. */
  parallelism?: number;
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
  /** The mentions of every keyword page by identifier, which its fragment records as passages. */
  keywordMentions: Map<string, KeywordMention[]>;
  /** The expressions of a similar form to every keyword page, which its fragment offers as leads. */
  keywordLeads: Map<string, KeywordLead[]>;
  /** The keyword page identifiers every note takes over, whose address the site keeps as a redirect. */
  takenOver: Map<string, string[]>;
  /** The recognised words of every note by `<source>/<path>`, which its fragment links in the text. */
  recognised: Map<string, RecognisedWord[]>;
  duplicates: DuplicateCounts;
  /** The documents that are not notes, read once, with their pages and PDF representation, for the fragments. */
  documents: ReadDocument[];
  /** Documents a converter could not convert, which `build.fail_on.unconverted_max` counts. */
  unconverted: number;
  /** The text of every note pseudonymisation rewrote, by `<source>/<path>`, which the fragments render in place of the file. */
  notes: Map<string, string>;
}

/**
 * The inference chain, from the ingested sources to the blocks of the model, each step a pure
 * function of the previous ones: parse, documents, transcripts pseudonymised, type, notes and
 * documents of the scope pseudonymised, plugin sources, operation notes, dictionary, scan,
 * links, combination, relation typing, keywords, twin resources, documents without a note,
 * model checks, displayed neighbourhood.
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { config, profile, sources, fs, clock } = input;
  const parsed = parseSources(sources, fs);
  const readers = input.plugins.readers();
  const read = await readDocuments({
    sources,
    readers,
    converters: input.plugins.converters(),
    config,
    cacheDirectory: input.cacheDirectory,
    parallelism: input.parallelism ?? 1,
    fs,
  });
  const pseudonymization = loadPseudonymization({
    config,
    configDirectory: input.configDirectory,
    fs,
  });
  const transcripts = pseudonymizeTranscripts({
    documents: read.documents,
    readers,
    config,
    pseudonymization,
    titles: parsed.documents.flatMap((note) =>
      note.document.title === undefined ? [] : [note.document.title],
    ),
    fs,
  });
  const typed = typeNotes({
    sources,
    documents: indexDocuments(parsed.documents),
    resources: resourcesOf(transcripts.documents),
    config,
    profile,
  });
  const scoped = pseudonymizeScope({
    entities: typed.entities,
    documents: parsed.documents,
    resources: transcripts.documents,
    sources,
    pseudonymization,
    fs,
  });
  const documents = indexDocuments(scoped.documents);
  const contributed = await loadPluginSources({
    providers: input.plugins.sources(),
    entities: scoped.entities,
    roots: Object.fromEntries(sources.map((source) => [source.name, source.root])),
    cacheDirectory: input.cacheDirectory,
    profile,
    context: { fs, clock, ...(input.fetch === undefined ? {} : { fetch: input.fetch }) },
  });
  const attached = attachOperationNotes({
    entities: [...scoped.entities, ...contributed.entities],
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
    documents: scoped.documents,
    resources: scoped.resources,
    sources,
    dictionaries: dictionaries.byLocale,
    profile,
    config,
  });
  const produced = produceLinks({ entities, sources, documents, occurrences, profile, config });
  const combined = combineProducedLinks([...produced.links, ...attached.links], profile);
  const refined = refineRelations(combined, { profile, entities });
  const keywords = discoverKeywords({
    documents: scoped.documents,
    resources: scoped.resources,
    sources,
    dictionaries: dictionaries.byLocale,
    config,
    profile,
    rejected: pseudonymization.names,
  });
  entities = [...entities, ...keywords.entities];
  const twins = reconcileTwins({
    entities,
    links: refined.links,
    documents,
    resources: scoped.resources,
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
      ...read.findings,
      ...pseudonymization.findings,
      ...transcripts.findings,
      ...typed.findings,
      ...contributed.findings,
      ...attached.findings,
      ...dictionaries.findings,
      ...produced.findings,
      ...refined.findings,
      ...keywords.findings,
      ...twins.findings,
      ...documentsWithoutMarkdown(twins.entities, scoped.resources),
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
    // The rows of the entities, then those of the keyword pages, whose identifiers are their own.
    neighbours: {
      ...neighbourhoodToModel(produced.neighbourhood),
      ...keywordNeighbours({
        occurrences,
        keywordMentions: keywords.mentions,
        options: neighbourhoodOptions(config.inference),
      }),
    },
    displayedNeighbourhood: displayedNeighbourhoodBlock({
      entities: twins.entities,
      links: twins.links,
      config,
      profile,
    }),
    contracts: contributed.contracts,
    keywords: keywords.counts,
    keywordMentions: keywords.mentions,
    keywordLeads: keywords.leads,
    takenOver: keywords.takenOver,
    recognised: recognisedWords({ occurrences, documents: scoped.documents, sources }),
    duplicates: twins.counts,
    documents: scoped.resources,
    unconverted: read.unconverted,
    notes: scoped.notes,
  };
}
