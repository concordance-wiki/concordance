import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config.mjs";

// Mutation testing runs the suite instrumented, several times slower: the tests that
// assert a wall-clock budget would fail in its dry run without telling anything about
// the mutants. They keep running in the ordinary test step.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "**/node_modules/**",
        "packages/lint/test/scale.test.ts",
        "packages/inference/test/neighbourhood/load.test.ts",
        "packages/nlp/test/scan/performance.test.ts",
      ],
    },
  }),
);
