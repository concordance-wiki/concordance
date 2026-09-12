import type { Config } from "@concordance-wiki/core";

/** The part of `concordance.lock.yaml` the discovery reads. */
export interface KeywordLock {
  rejected_terms?: readonly string[];
}

/** Every knob of the discovery, resolved from the configuration and the lock. */
export interface KeywordOptions {
  minWords: number;
  maxWords: number;
  /** Below this length of the normalised expression, an n-gram is noise; not configurable. */
  minLength: number;
  minOccurrences: number;
  minDocuments: number;
  /** `inference.candidate_score`: from this score a candidate yields `W-TERM-UNDEFINED`. */
  minScore: number;
  /** The lock's `rejected_terms`, as written. */
  rejected: ReadonlySet<string>;
}

export const keywordDefaults: Omit<KeywordOptions, "rejected"> = {
  minWords: 1,
  maxWords: 4,
  minLength: 3,
  minOccurrences: 3,
  minDocuments: 2,
  minScore: 4,
};

/** `inference.ngrams`, `inference.candidate_score` and the lock's `rejected_terms`, with their defaults. */
export function keywordOptions(config: Config, lock?: KeywordLock): KeywordOptions {
  const ngrams = config.inference?.ngrams ?? {};
  return {
    minWords: ngrams.min ?? keywordDefaults.minWords,
    maxWords: ngrams.max ?? keywordDefaults.maxWords,
    minLength: keywordDefaults.minLength,
    minOccurrences: ngrams.min_occurrences ?? keywordDefaults.minOccurrences,
    minDocuments: ngrams.min_documents ?? keywordDefaults.minDocuments,
    minScore: config.inference?.candidate_score ?? keywordDefaults.minScore,
    rejected: new Set(lock?.rejected_terms ?? []),
  };
}
