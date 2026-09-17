import { performance } from "node:perf_hooks";

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
  LockFile,
  Neighbours,
  PluginRegistry,
  SuggestedDomain,
} from "@concordance-wiki/core";
import { neighbourhoodOptions, neighbourhoodToModel } from "@concordance-wiki/inference";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

import { enrichStepFindings, runModelChecks } from "./checks.js";
import { combineProducedLinks } from "./combine.js";
import { keywordNeighbours } from "./companions.js";
import { buildDictionaries, corpusStopwords } from "./dictionary.js";
import { displayedNeighbourhoodBlock } from "./display.js";
import { proposeDomains, withFoldedTwins, withoutAnswered } from "./domains.js";
import {
  documentsWithoutMarkdown,
  readDocuments,
  resourcesOf,
  type ReadDocument,
} from "./documents.js";
import { reconcileTwins, repointLinks } from "./duplicates.js";
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
  /** The decisions of `concordance.lock.yaml`, read and validated by the command; none without a `lock` key. */
  lock?: LockFile;
  /** Told how long each step took, in the order the steps run; a diagnostic that never reaches the outputs. */
  observe?: StepObserver;
}

export type StepObserver = (step: string, milliseconds: number) => void;

/**
 * A marker of the steps: each call closes the step under way, telling the observer its
 * duration, and opens the next one. The wall clock of the process measures it, not the
 * injected clock, which a reproducible build pins.
 */
export function stepMarker(observe: StepObserver | undefined): (next?: string) => void {
  let current: string | undefined;
  let started = performance.now();
  return (next) => {
    const now = performance.now();
    if (current !== undefined) observe?.(current, Math.round(now - started));
    current = next;
    started = now;
  };
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
  /** The measured duration of the twin-resource reconciliation, in milliseconds, which the console summary prints and the log leaves out. */
  duplicateTimeMs: number;
  /** The documents that are not notes, read once, with their pages and PDF representation, for the fragments. */
  documents: ReadDocument[];
  /** Documents a converter could not convert, which `build.fail_on.unconverted_max` counts. */
  unconverted: number;
  /** The text of every note pseudonymisation rewrote, by `<source>/<path>`, which the fragments render in place of the file. */
  notes: Map<string, string>;
  /** The domains the neighbourhood proposes; absent while `inference.domains` is unset. */
  suggestedDomains?: SuggestedDomain[];
}

/**
 * The inference chain, from the ingested sources to the blocks of the model, each step a pure
 * function of the previous ones: parse, documents, transcripts pseudonymised, type, notes and
 * documents of the scope pseudonymised, plugin sources, operation notes, twin resources,
 * dictionary, scan, links, combination, relation typing, keywords, domains promoted or
 * proposed, documents without a note, model checks, displayed neighbourhood.
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { config, profile, sources, fs, clock } = input;
  const mark = stepMarker(input.observe);
  mark("parse");
  const parsed = parseSources(sources, fs);
  const readers = input.plugins.readers();
  mark("read documents");
  const read = await readDocuments({
    sources,
    readers,
    converters: input.plugins.converters(),
    config,
    cacheDirectory: input.cacheDirectory,
    parallelism: input.parallelism ?? 1,
    fs,
  });
  mark("load pseudonymisation");
  const pseudonymization = loadPseudonymization({
    config,
    configDirectory: input.configDirectory,
    fs,
  });
  mark("pseudonymise transcripts");
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
  mark("type notes");
  const typed = typeNotes({
    sources,
    documents: indexDocuments(parsed.documents),
    resources: resourcesOf(transcripts.documents),
    config,
    profile,
  });
  mark("scope privacy");
  const scoped = pseudonymizeScope({
    entities: typed.entities,
    documents: parsed.documents,
    resources: transcripts.documents,
    sources,
    pseudonymization,
    fs,
  });
  mark("index documents");
  const documents = indexDocuments(scoped.documents);
  mark("import contracts");
  const contributed = await loadPluginSources({
    providers: input.plugins.sources(),
    entities: scoped.entities,
    roots: Object.fromEntries(sources.map((source) => [source.name, source.root])),
    dates: Object.fromEntries(
      sources.map((source) => [
        source.name,
        Object.fromEntries(source.files.map((file) => [file.path, file.modifiedAt])),
      ]),
    ),
    cacheDirectory: input.cacheDirectory,
    profile,
    context: { fs, clock, ...(input.fetch === undefined ? {} : { fetch: input.fetch }) },
  });
  mark("attach operations");
  const attached = attachOperationNotes({
    entities: [...scoped.entities, ...contributed.entities],
    links: contributed.links,
    profile,
    // The same default as the ingest step gives a source without a locale of its own.
    locale: config.project.locale ?? "en",
  });
  mark("stopwords");
  const stopwords = corpusStopwords({
    sources,
    config,
    configDirectory: input.configDirectory,
    fs,
  });
  // Before the dictionary: a twin folded into its note must not enter it as a homonym of the note.
  mark("reconcile twins");
  const twins = reconcileTwins({
    entities: attached.entities,
    documents,
    resources: scoped.resources,
    sources,
    stopwords,
    config,
    profile,
    clock,
    ...(input.lock?.duplicates === undefined ? {} : { lock: input.lock.duplicates }),
  });
  mark("build dictionaries");
  const dictionaries = buildDictionaries({
    entities: twins.entities,
    folded: twins.folded,
    config,
    stopwords,
  });
  mark("scan occurrences");
  const occurrences = scanNotes({
    documents: scoped.documents,
    resources: scoped.resources,
    sources,
    dictionaries: dictionaries.byLocale,
    profile,
    config,
  });
  // The files of a folded twin still declare and receive links, moved to its entity once the relations are typed.
  const declaring = [...twins.entities, ...twins.folded.map((twin) => twin.entity)];
  mark("produce links");
  const produced = produceLinks({
    entities: declaring,
    sources,
    documents,
    occurrences,
    profile,
    config,
  });
  mark("combine links");
  const combined = combineProducedLinks([...produced.links, ...attached.links], profile);
  mark("refine relations");
  const refined = refineRelations(combined, { profile, entities: declaring });
  mark("discover keywords");
  const keywords = discoverKeywords({
    documents: scoped.documents,
    resources: scoped.resources,
    sources,
    dictionaries: dictionaries.byLocale,
    config,
    profile,
    rejected: pseudonymization.names,
    ...(input.lock === undefined ? {} : { lock: input.lock }),
  });
  const entities = [...twins.entities, ...keywords.entities];
  mark("repoint links");
  const links = repointLinks(refined.links, twins.folded, profile);
  mark("propose domains");
  const domains = proposeDomains({
    entities,
    links,
    neighbourhood: produced.neighbourhood,
    config,
    dictionaries: dictionaries.byLocale,
    ...(input.lock === undefined ? {} : { lock: input.lock }),
  });
  mark("model checks");
  const checked = runModelChecks({
    registry: input.checks,
    entities: domains.entities,
    links,
    sources,
    profile,
    ...(config.checks === undefined ? {} : { overrides: config.checks }),
  });
  mark("enrich findings");
  const findings = enrichStepFindings(
    input.checks,
    [
      ...input.findings,
      ...parsed.findings,
      ...read.findings,
      ...pseudonymization.findings,
      ...transcripts.findings,
      ...withoutAnswered(typed.findings, withFoldedTwins(domains.filed, twins.folded)),
      ...contributed.findings,
      ...attached.findings,
      ...twins.findings,
      ...dictionaries.findings,
      ...produced.findings,
      ...refined.findings,
      ...keywords.findings,
      ...domains.findings,
      ...documentsWithoutMarkdown(domains.entities, scoped.resources),
      ...checked,
    ],
    config.checks,
  );
  mark("assemble result");
  const result: PipelineResult = {
    files: sources.reduce((count, source) => count + source.files.length, 0),
    entities: domains.entities,
    links,
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
      entities: domains.entities,
      links,
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
    duplicateTimeMs: twins.timeMs,
    documents: scoped.resources,
    unconverted: read.unconverted,
    notes: scoped.notes,
    ...(domains.suggested === undefined ? {} : { suggestedDomains: domains.suggested }),
  };
  mark();
  return result;
}
