import type { Clock, Finding } from "@concordance-wiki/core";

/** What the reconciliation needs of a resource; `text` is extracted text, never binary content. */
export interface DuplicateResource {
  /** Unique per resource; the lock file names resources by it. */
  id: string;
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  /** Folder part of `path`, empty at the root. */
  folder: string;
  /** File name without its extension. */
  baseName: string;
  /** Document property, as a reader plugin reports it. */
  title?: string;
  /** First level-one heading of a markdown note. */
  heading?: string;
  /** Frontmatter `source`: the twin a note declares, relative to its folder or `<source>:<path>`. */
  declaredSource?: string;
  commit?: string;
  text: string;
}

export type DuplicateMode = "estimate" | "exact" | "auto";

export interface DuplicateOptions {
  mode: DuplicateMode;
  /** Estimated Jaccard from which `auto` recomputes the exact one. */
  exactAbove: number;
  /** Word-count ratio under which the content signal is capped at the lower weight. */
  sizeRatioMin: number;
  shingleSize: number;
  minhashFunctions: number;
  /** Strictly above: merged. */
  mergeAbove: number;
  /** At least: a `W-DUP-CANDIDATE` finding. */
  candidateAbove: number;
}

/** Ordered pairs of resource identifiers, as `duplicates.merged` and `duplicates.separated` of the lock file. */
export interface DuplicateLock {
  merged?: readonly (readonly [string, string])[];
  separated?: readonly (readonly [string, string])[];
}

export interface DuplicateInput {
  resources: readonly DuplicateResource[];
  /** The words of a text in comparison form, stopwords removed; the language pack of the source provides it. */
  normalizeText: (text: string) => string[];
  lock?: DuplicateLock;
  /** Measures the time spent; without it the statistics report zero. */
  clock?: Clock;
}

/** One contribution to the score of a pair. */
export interface DuplicateSignal {
  name:
    | "declared"
    | "same_name"
    | "similar_name"
    | "same_title"
    | "similar_content"
    | "same_commit"
    | "same_directory";
  weight: number;
  /** Named in the finding message next to the weight. */
  detail: string;
}

export interface DuplicatePair {
  /** The lower identifier. */
  a: string;
  b: string;
  /** Sum of the signal weights, capped at 1 and rounded to four decimals. */
  score: number;
  /** By weight then by name, so that the first one names the grouping criterion. */
  signals: DuplicateSignal[];
}

export interface DuplicateRepresentation {
  id: string;
  path: string;
  /** `markdown` for a note, otherwise the lowercase extension, `file` without one. */
  format: string;
}

/** Several resources merged into one entity. */
export interface DuplicateGroup {
  /** The identifier of the markdown representation, or the lowest identifier without one. */
  id: string;
  representations: DuplicateRepresentation[];
  /** What grouped the resources, for the page to name it. */
  criterion: string;
}

export interface DuplicateStats {
  resources: number;
  /** Pairs enumerated by the LSH banding, the only ones whose content is compared. */
  candidatePairs: number;
  /** Pairs whose signals were scored: brought together by their content, a base name, a title or a declaration, and not separated by the lock. */
  scoredPairs: number;
  exactVerifications: number;
  merged: number;
  candidates: number;
  timeMs: number;
}

export interface DuplicateResult {
  groups: DuplicateGroup[];
  findings: Finding[];
  /** Every scored pair, at or above `candidateAbove`, by identifiers. */
  pairs: DuplicatePair[];
  stats: DuplicateStats;
}
