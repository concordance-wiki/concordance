import { byCodeUnit } from "@concordance-wiki/core";

import type { LanguagePack } from "../locale/pack.js";
import {
  confidenceDefaults,
  confidenceOf,
  confidencePenalties,
  type ConfidencePenalty,
  type ConfidenceSignals,
} from "./confidence.js";
import { keywordForms, ngramContext, ngramSurface, type NgramOccurrence } from "./ngrams.js";

export interface KeywordMention {
  source?: string;
  path: string;
  line: number;
  position: number;
  /** The span as written in the text, which the context holds. */
  surface: string;
  context: string;
}

export interface KeywordCandidate {
  key: string;
  /** The most frequent surface form, the first mention deciding a tie. */
  display: string;
  words: number;
  occurrences: number;
  /** Distinct files the expression appears in. */
  documents: number;
  /** C-value × IDF, rounded to four decimals. */
  score: number;
  /** The product of the confidence signals, in [0, 1], rounded to four decimals. */
  confidence: number;
  /** What the confidence was read from, the shares rounded to four decimals. */
  signals: ConfidenceSignals;
  /** The signals that lowered the confidence, in the order of the formula. */
  penalties: ConfidencePenalty[];
  /** Sorted by source, path, line, then position. */
  mentions: KeywordMention[];
}

export interface ScoreCandidatesOptions {
  pack: LanguagePack;
  /** Comparison forms of the dictionary entries: an expression already defined is no candidate. */
  dictionaryKeys: ReadonlySet<string>;
  /** The lock's `rejected_terms`, as written. */
  rejected: ReadonlySet<string>;
  minOccurrences: number;
  minDocuments: number;
  /**
   * The n-grams of the prominent texts, headings, written links and frontmatter, extracted
   * like the units: an expression put forward there gains confidence. None by default.
   */
  prominent?: readonly NgramOccurrence[];
  /** Share of the files beyond which an expression belongs to the language; 0.5 by default. */
  maxSpread?: number;
}

interface Group {
  key: string;
  words: string[];
  occurrences: NgramOccurrence[];
  documents: Set<string>;
  /** Frequencies of the frequent longer n-grams containing this one, one per n-gram. */
  longer: number[];
  /** Set when a frequent n-gram made of this one, or this one itself, also holds a defined term. */
  neighbour: boolean;
}

interface Thresholds {
  minOccurrences: number;
  minDocuments: number;
}

function documentOf(occurrence: { source?: string; path: string }): string {
  // A separator no path and no source name can hold, written as an escape so that the file stays
  // text: a raw NUL byte makes git read the source as binary, and every diff of it unreadable.
  return `${occurrence.source ?? ""}\u0000${occurrence.path}`;
}

/** Canonical order of mentions: source, path, line, position. */
export function compareMentions(
  a: Pick<NgramOccurrence, "source" | "path" | "line" | "position">,
  b: Pick<NgramOccurrence, "source" | "path" | "line" | "position">,
): number {
  return (
    byCodeUnit(a.source ?? "", b.source ?? "") ||
    byCodeUnit(a.path, b.path) ||
    a.line - b.line ||
    a.position - b.position
  );
}

function compareCandidates(a: KeywordCandidate, b: KeywordCandidate): number {
  return b.score - a.score || byCodeUnit(a.key, b.key);
}

/** The keys of every shorter contiguous word sequence of an n-gram, each once. */
function nestedKeys(words: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (let size = 1; size < words.length; size += 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      keys.add(words.slice(start, start + size).join(" "));
    }
  }
  return keys;
}

function isFrequent(group: Group, thresholds: Thresholds): boolean {
  return (
    group.occurrences.length >= thresholds.minOccurrences &&
    group.documents.size >= thresholds.minDocuments
  );
}

function hasDefined(keys: ReadonlySet<string>, defined: ReadonlySet<string>): boolean {
  for (const key of keys) {
    if (defined.has(key)) return true;
  }
  return false;
}

// Only an n-gram above the thresholds penalises the ones it contains: a rare longer
// n-gram explains nothing, and a frequent one keeps penalising even when excluded. The
// same n-gram, when a defined term is one of its parts, vouches for its other parts.
function groupByKey(
  occurrences: readonly NgramOccurrence[],
  thresholds: Thresholds,
  defined: ReadonlySet<string>,
): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const occurrence of occurrences) {
    let group = groups.get(occurrence.key);
    if (group === undefined) {
      group = {
        key: occurrence.key,
        words: occurrence.key.split(" "),
        occurrences: [],
        documents: new Set(),
        longer: [],
        neighbour: false,
      };
      groups.set(occurrence.key, group);
    }
    group.occurrences.push(occurrence);
    group.documents.add(documentOf(occurrence));
  }
  for (const group of groups.values()) {
    if (!isFrequent(group, thresholds)) continue;
    const nested = nestedKeys(group.words);
    const vouches = hasDefined(nested, defined);
    group.neighbour ||= vouches;
    for (const key of nested) {
      const part = groups.get(key);
      if (part === undefined) continue;
      part.longer.push(group.occurrences.length);
      part.neighbour ||= vouches;
    }
  }
  return groups;
}

/**
 * The C-value of an n-gram: its frequency, minus the mean frequency of the frequent longer
 * n-grams containing it, weighted by log2(words + 1) so that a unigram weighs one. An n-gram
 * nested in a longer one as frequent as itself scores zero.
 */
function cValue(group: Group): number {
  const weight = Math.log2(group.words.length + 1);
  const nested =
    group.longer.length === 0
      ? 0
      : group.longer.reduce((sum, frequency) => sum + frequency, 0) / group.longer.length;
  return weight * (group.occurrences.length - nested);
}

/** How many times each key appears in the prominent texts. */
function prominenceByKey(prominent: readonly NgramOccurrence[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { key } of prominent) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function isInflected(words: readonly string[], suffixes: ReadonlySet<string>): boolean {
  return words.some((word) =>
    [...suffixes].some((suffix) => word.length > suffix.length && word.endsWith(suffix)),
  );
}

function share(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** The five signals of a group, read on the corpus of `corpus` files. */
function signalsOf(
  group: Group,
  corpus: number,
  prominent: number,
  pack: LanguagePack,
): ConfidenceSignals {
  return {
    spread: share(group.documents.size / corpus),
    burst: share(group.occurrences.length / group.documents.size),
    prominence: share(Math.min(1, prominent / group.occurrences.length)),
    neighbour: group.neighbour,
    inflected: isInflected(group.words, pack.suffixes),
  };
}

function display(occurrences: readonly NgramOccurrence[]): string {
  const counts = new Map<string, number>();
  let best = "";
  let bestCount = 0;
  for (const surface of occurrences.map(ngramSurface)) {
    const count = (counts.get(surface) ?? 0) + 1;
    counts.set(surface, count);
    if (count > bestCount) {
      best = surface;
      bestCount = count;
    }
  }
  return best;
}

function mentionOf(occurrence: NgramOccurrence): KeywordMention {
  return {
    ...(occurrence.source === undefined ? {} : { source: occurrence.source }),
    path: occurrence.path,
    line: occurrence.line,
    position: occurrence.position,
    surface: ngramSurface(occurrence),
    context: ngramContext(occurrence),
  };
}

/**
 * The expressions worth a page: the n-grams grouped by key, scored by C-value × IDF, kept
 * from `minOccurrences` occurrences in `minDocuments` distinct files, best score first,
 * each with its confidence of being a term of the subject rather than a word of the
 * language, read in the same pass from the shape of its distribution. An expression
 * defined in the dictionary or rejected in the lock is never a candidate, but still
 * penalises the n-grams it contains, so that the words of a defined term do not surface
 * on their own.
 */
export function scoreCandidates(
  occurrences: readonly NgramOccurrence[],
  options: ScoreCandidatesOptions,
): KeywordCandidate[] {
  const defined = keywordForms(options.dictionaryKeys, options.pack);
  const excluded = new Set([...defined, ...keywordForms(options.rejected, options.pack)]);
  const groups = groupByKey(occurrences, options, defined);
  const corpus = new Set(occurrences.map(documentOf)).size;
  const prominence = prominenceByKey(options.prominent ?? []);
  const confidenceOptions = { maxSpread: options.maxSpread ?? confidenceDefaults.maxSpread };
  const candidates: KeywordCandidate[] = [];

  for (const group of groups.values()) {
    if (excluded.has(group.key) || !isFrequent(group, options)) continue;
    const sorted = [...group.occurrences].sort(compareMentions);
    const idf = Math.log(1 + corpus / group.documents.size);
    const signals = signalsOf(group, corpus, prominence.get(group.key) ?? 0, options.pack);
    const input = { ...signals, corpus, files: group.documents.size };
    candidates.push({
      key: group.key,
      display: display(sorted),
      words: group.words.length,
      occurrences: sorted.length,
      documents: group.documents.size,
      score: Math.round(cValue(group) * idf * 10_000) / 10_000,
      confidence: confidenceOf(input, confidenceOptions),
      signals,
      penalties: confidencePenalties(input, confidenceOptions),
      mentions: sorted.map(mentionOf),
    });
  }
  return candidates.sort(compareCandidates);
}
