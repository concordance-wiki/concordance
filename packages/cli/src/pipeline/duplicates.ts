import { posix } from "node:path";

import {
  compareFindings,
  type Clock,
  type Config,
  type DuplicateCandidate,
  type DuplicateCounts,
  type Entity,
  type Finding,
  type Link,
} from "@concordance-wiki/core";
import {
  duplicateOptions,
  resolveDuplicateResources,
  type DuplicateGroup,
  type DuplicateLock,
  type DuplicateResource,
  type DuplicateStats,
} from "@concordance-wiki/inference";
import { scannableText, type IngestedSource, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { comparisonWords, languagePack } from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

import { combineProducedLinks } from "./combine.js";
import type { ReadDocument } from "./documents.js";
import { documentKey } from "./parse.js";

export interface ReconcileTwinsInput {
  entities: readonly Entity[];
  /** Parsed notes keyed by `<source name>/<path>`; an entity with neither a note nor a document is not a resource. */
  documents: ReadonlyMap<string, ParsedMarkdown>;
  /** The documents that are not notes, whose title and extracted text enter the comparison. */
  resources?: readonly ReadDocument[];
  sources: readonly IngestedSource[];
  /** The stopwords of every locale of the corpus, which the text similarity leaves out. */
  stopwords: ReadonlyMap<string, ReadonlySet<string>>;
  config: Config;
  profile: Profile;
  clock: Clock;
  lock?: DuplicateLock;
}

/** An entity a merge folded into another: the twin as typed, and the identifier it now answers to. */
export interface FoldedEntity {
  entity: Entity;
  into: string;
}

export interface ReconciledTwins {
  /** The entities with every merged group folded into its note, representations recorded. */
  entities: Entity[];
  /**
   * The twins that disappeared into a merged entity, in the order of the entities. Their titles
   * and aliases still name the entity in the dictionary and their files still declare links, which
   * `repointLinks` moves to the entity.
   */
  folded: FoldedEntity[];
  /** `W-DUP-CANDIDATE`, one per pair that stays separate. */
  findings: Finding[];
  /** Every scored pair, as the `candidates.duplicates` block records it. */
  candidates: DuplicateCandidate[];
  counts: DuplicateCounts;
  /** The measured duration of the reconciliation, in milliseconds, for the console summary alone: the log never depends on the clock. */
  timeMs: number;
}

/** The file name without its extension; every resource is a file with one. */
function baseNameOf(path: string): string {
  const name = posix.basename(path);
  return name.slice(0, name.lastIndexOf("."));
}

/** The title a reader reported for a document, when it is a string worth comparing. */
function titleOf(document: ReadDocument): string | undefined {
  const title = document.metadata["title"];
  return typeof title === "string" && title.trim() !== "" ? title : undefined;
}

function folderOf(path: string): string {
  const folder = posix.dirname(path);
  return folder === "." ? "" : folder;
}

/** What locates a resource, note or document alike: its identifier, file, folder, base name, declaration and commit. */
function locationOf(entity: Entity, source: IngestedSource) {
  const declared = entity.attributes["source"];
  return {
    id: entity.id,
    source: source.name,
    path: entity.source.path,
    folder: folderOf(entity.source.path),
    baseName: baseNameOf(entity.source.path),
    ...(typeof declared === "string" ? { declaredSource: declared } : {}),
    ...(entity.source.commit === undefined ? {} : { commit: entity.source.commit }),
  };
}

/**
 * The notes and documents of one source as the reconciliation reads them: the text of a note is
 * its plain text, the text of a document is the text extracted from its pages, and a document
 * brings the title its reader reported where a note brings its heading.
 */
function resourcesOf(
  entities: readonly Entity[],
  documents: ReadonlyMap<string, ParsedMarkdown>,
  read: ReadonlyMap<string, ReadDocument>,
  source: IngestedSource,
): DuplicateResource[] {
  const resources: DuplicateResource[] = [];
  for (const entity of entities) {
    if (entity.source.name !== source.name) continue;
    const key = documentKey(entity.source.name, entity.source.path);
    const resource = read.get(key);
    if (resource !== undefined) {
      const title = titleOf(resource);
      resources.push({
        ...locationOf(entity, source),
        ...(title === undefined ? {} : { title }),
        text: resource.pages.map((page) => page.text).join("\n"),
      });
      continue;
    }
    const document = documents.get(key);
    if (document === undefined) continue;
    resources.push({
      ...locationOf(entity, source),
      ...(document.title === undefined ? {} : { heading: document.title }),
      text: scannableText(document)
        .map((unit) => unit.text)
        .join("\n"),
    });
  }
  return resources;
}

function addCounts(total: DuplicateCounts, stats: DuplicateStats): void {
  total.resources += stats.resources;
  total.candidatePairs += stats.candidatePairs;
  total.scoredPairs += stats.scoredPairs;
  total.exactVerifications += stats.exactVerifications;
  total.merged += stats.merged;
  total.candidates += stats.candidates;
}

/** The identifier every member of a merged group now answers to. */
function mergedInto(groups: readonly DuplicateGroup[]): Map<string, string> {
  const target = new Map<string, string>();
  for (const group of groups) {
    for (const representation of group.representations) target.set(representation.id, group.id);
  }
  return target;
}

function mergeEntities(
  entities: readonly Entity[],
  groups: readonly DuplicateGroup[],
): Pick<ReconciledTwins, "entities" | "folded"> {
  const target = mergedInto(groups);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const merged: Entity[] = [];
  const folded: FoldedEntity[] = [];
  for (const entity of entities) {
    const root = target.get(entity.id);
    if (root !== undefined && root !== entity.id) {
      folded.push({ entity, into: root });
      continue;
    }
    const group = byId.get(entity.id);
    merged.push(
      group === undefined
        ? entity
        : {
            ...entity,
            representations: group.representations.map(({ path, format }) => ({ path, format })),
            grouped_by: group.criterion,
          },
    );
  }
  return { entities: merged, folded };
}

/**
 * The links of a folded twin moved to the entity it answers to, at both ends, a link the move
 * turns onto itself dropped, and the result combined again so that a link the twin and its note
 * both declared is one. The links are returned as they are when nothing was folded.
 */
export function repointLinks(
  links: readonly Link[],
  folded: readonly FoldedEntity[],
  profile: Profile,
): Link[] {
  if (folded.length === 0) return [...links];
  const target = new Map(folded.map((twin) => [twin.entity.id, twin.into]));
  const repointed = links.flatMap((link) => {
    const from = target.get(link.from) ?? link.from;
    const to = target.get(link.to) ?? link.to;
    return from === to ? [] : [{ ...link, from, to }];
  });
  return combineProducedLinks(repointed, profile);
}

/**
 * Twin resources among the notes and the documents, locale by locale: notes declaring a twin
 * under `source`, files sharing a base name, a document whose title is the heading of a note, or
 * texts that are similar. Above the merge threshold the resources become one entity carrying
 * every representation; from the candidate threshold they stay separate with a finding. The
 * text similarity works on the words of the language pack of the locale, its stopwords removed.
 * The step runs before the dictionary is built, so that a twin folded into its note never enters
 * the dictionary as a homonym of that note.
 */
export function reconcileTwins(input: ReconcileTwinsInput): ReconciledTwins {
  const options = duplicateOptions(input.config.inference);
  const findings: Finding[] = [];
  const candidates: DuplicateCandidate[] = [];
  const groups: DuplicateGroup[] = [];
  const counts: DuplicateCounts = {
    resources: 0,
    candidatePairs: 0,
    scoredPairs: 0,
    exactVerifications: 0,
    merged: 0,
    candidates: 0,
  };
  let timeMs = 0;
  const read = new Map(
    (input.resources ?? []).map((document) => [
      documentKey(document.source, document.path),
      document,
    ]),
  );
  for (const [locale, stopwords] of input.stopwords) {
    const pack = languagePack(locale);
    const excluded = new Set([...stopwords].flatMap((word) => comparisonWords(word, pack)));
    const sources = input.sources.filter((source) => source.locale === locale);
    const result = resolveDuplicateResources(
      {
        resources: sources.flatMap((source) =>
          resourcesOf(input.entities, input.documents, read, source),
        ),
        normalizeText: (text) => comparisonWords(text, pack).filter((word) => !excluded.has(word)),
        clock: input.clock,
        ...(input.lock === undefined ? {} : { lock: input.lock }),
      },
      options,
    );
    findings.push(...result.findings);
    groups.push(...result.groups);
    candidates.push(
      ...result.pairs.map((pair) => ({
        resources: [pair.a, pair.b],
        score: pair.score,
        signals: pair.signals.map((signal) => signal.name),
      })),
    );
    addCounts(counts, result.stats);
    timeMs += result.stats.timeMs;
  }
  return {
    ...mergeEntities(input.entities, groups),
    findings: findings.toSorted(compareFindings),
    candidates,
    counts,
    timeMs,
  };
}
