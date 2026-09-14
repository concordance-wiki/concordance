// Mutation testing of the pure packages. `scripts/mutation.mjs` narrows the run to one
// package (nightly) or to the files a pull request changed, and picks the incremental file.
/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: { configFile: "vitest.stryker.config.mjs" },
  mutate: [
    "packages/core/src/**/*.ts",
    "packages/typing/src/**/*.ts",
    "packages/nlp/src/**/*.ts",
    "packages/inference/src/**/*.ts",
    "packages/checks/src/**/*.ts",
  ],
  thresholds: { high: 95, low: 90, break: 85 },
  // The initial run executes the whole suite instrumented, on one thread: about four minutes
  // on a hosted runner with a few files mutated, more with a whole package.
  dryRunTimeoutMinutes: 15,
  // A mutant is given the time its own tests took, plus this margin, before it counts as hung.
  // The margin used to be five seconds, which only ever paid for the busiest runners.
  timeoutMS: 2000,
  timeoutFactor: 1.25,
  // Results are reused from one run to the next when neither the mutant nor the tests that cover
  // it changed; the pipeline caches the file, `--force` rebuilds it.
  incremental: true,
  incrementalFile: "reports/mutation/incremental.json",
  reporters: ["clear-text", "progress", "html", "json"],
  clearTextReporter: { reportTests: false },
  tempDirName: ".stryker-tmp",
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
};
