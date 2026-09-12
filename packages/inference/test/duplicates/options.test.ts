import { describe, expect, it } from "vitest";

import { DUPLICATE_DEFAULTS, duplicateOptions } from "../../src/duplicates/options.js";

describe("the duplicate options", () => {
  it("estimates then verifies above 0.5 by default, with 5-word shingles and 128 functions", () => {
    const defaults = {
      mode: "auto",
      exactAbove: 0.5,
      sizeRatioMin: 0.5,
      shingleSize: 5,
      minhashFunctions: 128,
      mergeAbove: 0.9,
      candidateAbove: 0.5,
    };
    expect(DUPLICATE_DEFAULTS).toEqual(defaults);
    expect(duplicateOptions()).toEqual(defaults);
    expect(duplicateOptions({})).toEqual(defaults);
    expect(duplicateOptions({ duplicates: {} })).toEqual(defaults);
  });

  it("reads every key of inference.duplicates", () => {
    expect(
      duplicateOptions({
        duplicates: {
          mode: "exact",
          exact_above: 0.3,
          size_ratio_min: 0.7,
          shingle_size: 3,
          minhash_functions: 64,
          merge_above: 0.95,
          candidate_above: 0.6,
        },
      }),
    ).toEqual({
      mode: "exact",
      exactAbove: 0.3,
      sizeRatioMin: 0.7,
      shingleSize: 3,
      minhashFunctions: 64,
      mergeAbove: 0.95,
      candidateAbove: 0.6,
    });
  });
});
