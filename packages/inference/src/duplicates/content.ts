import { candidatePairs } from "./lsh.js";
import { createMinHash, estimatedJaccard } from "./minhash.js";
import { exactJaccard, normaliseText, sharedLines, shingleSet } from "./shingles.js";
import type { NormalisedText } from "./shingles.js";
import type { DuplicateOptions, DuplicateResource } from "./types.js";

/** How the texts of two resources compare, from the shingle sets, never from the binary files. */
export interface ContentSimilarity {
  jaccard: number;
  /** Whether `jaccard` was recomputed on the full shingle sets. */
  exact: boolean;
  /** Words of the shorter text over words of the longer one. */
  sizeRatio: number;
  /** Distinct lines in common over the distinct lines of both; present with an exact verification. */
  sharedLines?: number;
}

export interface ContentPair {
  /** The earlier resource. */
  a: DuplicateResource;
  b: DuplicateResource;
  similarity: ContentSimilarity;
}

export interface ContentResult {
  /** In resource order, the only pairs whose content was compared. */
  pairs: ContentPair[];
  exactVerifications: number;
}

interface Prepared {
  resource: DuplicateResource;
  text: NormalisedText;
  shingles: Set<string>;
  signature: Uint32Array;
}

// Only shingled texts are compared, so neither count is zero.
function sizeRatio(a: number, b: number): number {
  return Math.min(a, b) / Math.max(a, b);
}

/**
 * Estimates the similarity of every pair the LSH banding brings together, and recomputes it
 * exactly according to the mode: on every pair in `exact`, never in `estimate`, from
 * `exactAbove` in `auto`.
 */
export function contentSimilarities(
  resources: readonly DuplicateResource[],
  normalizeText: (text: string) => string[],
  options: DuplicateOptions,
): ContentResult {
  const minHash = createMinHash(options.minhashFunctions);
  const prepared = resources.map((resource): Prepared => {
    const text = normaliseText(resource.text, normalizeText);
    const shingles = shingleSet(text.words, options.shingleSize);
    return { resource, text, shingles, signature: minHash.signature(shingles) };
  });
  // A text shorter than a shingle has nothing to compare; its empty signature must not bucket with every other.
  const shingled = prepared.filter((item) => item.shingles.size > 0);
  const pairs: ContentPair[] = [];
  let exactVerifications = 0;
  for (const [a, b] of candidatePairs(shingled, (item) => item.signature)) {
    const estimate = estimatedJaccard(a.signature, b.signature);
    const verify =
      options.mode === "exact" || (options.mode === "auto" && estimate >= options.exactAbove);
    const ratio = sizeRatio(a.text.words.length, b.text.words.length);
    let similarity: ContentSimilarity = { jaccard: estimate, exact: false, sizeRatio: ratio };
    if (verify) {
      exactVerifications++;
      similarity = {
        jaccard: exactJaccard(a.shingles, b.shingles),
        exact: true,
        sizeRatio: ratio,
        sharedLines: sharedLines(a.text.lines, b.text.lines),
      };
    }
    pairs.push({ a: a.resource, b: b.resource, similarity });
  }
  return { pairs, exactVerifications };
}
