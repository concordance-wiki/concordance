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
import type { LocaleDictionary } from "./dictionary.js";
import type { ReadDocument } from "./documents.js";
import { documentKey } from "./parse.js";

export interface ReconcileTwinsInput {
  entities: readonly Entity[];
  links: readonly Link[];
  /** Parsed notes keyed by `<source name>/<path>`; an entity with neither a note nor a document, or a keyword page, is not a resource. */
  documents: ReadonlyMap<string, ParsedMarkdown>;
  /** The documents that are not notes, whose title and extracted text enter the comparison. */
  resources?: readonly ReadDocument[];
  sources: readonly IngestedSource[];
  dictionaries: ReadonlyMap<string, LocaleDictionary>;
  config: Config;
  profile: Profile;
  clock: Clock;
  lock?: DuplicateLock;
}

export interface ReconciledTwins {
  /** The entities with every merged group folded into its note, representations recorded. */
  entities: Entity[];
  /** The links, those of a merged twin re-pointed at its note and combined again. */
  links: Link[];
  /** `W-DUP-CANDIDATE`, one per pair that stays separate. */
  findings: Finding[];
  /** Every scored pair, as the `candidates.duplicates` block records it. */
  candidates: DuplicateCandidate[];
  counts: DuplicateCounts;
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
    // A keyword page is located on the note that first mentions its expression: it has no file of its own.
    if (entity.source.name !== source.name || entity.keyword === true) continue;
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
  total.timeMs += stats.timeMs;
}

/** The identifier every member of a merged group now answers to. */
function mergedInto(groups: readonly DuplicateGroup[]): Map<string, string> {
  const target = new Map<string, string>();
  for (const group of groups) {
    for (const representation of group.representations) target.set(representation.id, group.id);
  }
  return target;
}

function mergeEntities(entities: readonly Entity[], groups: readonly DuplicateGroup[]): Entity[] {
  const target = mergedInto(groups);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const merged: Entity[] = [];
  for (const entity of entities) {
    const root = target.get(entity.id);
    if (root !== undefined && root !== entity.id) continue;
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
  return merged;
}

function repointLinks(
  links: readonly Link[],
  groups: readonly DuplicateGroup[],
  profile: Profile,
): Link[] {
  if (groups.length === 0) return [...links];
  const target = mergedInto(groups);
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
    timeMs: 0,
  };
  const read = new Map(
    (input.resources ?? []).map((document) => [
      documentKey(document.source, document.path),
      document,
    ]),
  );
  for (const [locale, { stopwords }] of input.dictionaries) {
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
  }
  return {
    entities: mergeEntities(input.entities, groups),
    links: repointLinks(input.links, groups, input.profile),
    findings: findings.sort(compareFindings),
    candidates,
    counts,
  };
}
