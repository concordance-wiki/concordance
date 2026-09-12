import type { InferenceConfig } from "@concordance-wiki/core";

import type { DuplicateOptions } from "./types.js";

export const DUPLICATE_DEFAULTS: DuplicateOptions = {
  mode: "auto",
  exactAbove: 0.5,
  sizeRatioMin: 0.5,
  shingleSize: 5,
  minhashFunctions: 128,
  mergeAbove: 0.9,
  candidateAbove: 0.5,
};

/** `inference.duplicates` of the configuration over the defaults. */
export function duplicateOptions(inference?: InferenceConfig): DuplicateOptions {
  const duplicates = inference?.duplicates;
  return {
    mode: duplicates?.mode ?? DUPLICATE_DEFAULTS.mode,
    exactAbove: duplicates?.exact_above ?? DUPLICATE_DEFAULTS.exactAbove,
    sizeRatioMin: duplicates?.size_ratio_min ?? DUPLICATE_DEFAULTS.sizeRatioMin,
    shingleSize: duplicates?.shingle_size ?? DUPLICATE_DEFAULTS.shingleSize,
    minhashFunctions: duplicates?.minhash_functions ?? DUPLICATE_DEFAULTS.minhashFunctions,
    mergeAbove: duplicates?.merge_above ?? DUPLICATE_DEFAULTS.mergeAbove,
    candidateAbove: duplicates?.candidate_above ?? DUPLICATE_DEFAULTS.candidateAbove,
  };
}
