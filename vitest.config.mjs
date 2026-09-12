import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packages = fileURLToPath(new URL("./packages/", import.meta.url));

export default defineConfig({
  // Tests exercise sources across packages, so that coverage and mutation testing see every file once.
  resolve: {
    alias: [{ find: /^@concordance-wiki\/([a-z-]+)$/, replacement: `${packages}$1/src/index.ts` }],
  },
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "plugins/*/test/**/*.test.ts",
      "presets/*/test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "plugins/*/src/**/*.ts", "presets/*/src/**/*.ts"],
      // The executable wrapper only wires process to main(); it is exercised by the pipeline, not by unit tests.
      exclude: ["packages/cli/src/bin.ts"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
