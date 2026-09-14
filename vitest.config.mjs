import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packages = fileURLToPath(new URL("./packages/", import.meta.url));
const plugins = fileURLToPath(new URL("./plugins/", import.meta.url));

export default defineConfig({
  // Components of the site are TSX compiled for Preact; the setting applies to every package.
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  // Tests exercise sources across packages, so that coverage and mutation testing see every file once.
  resolve: {
    alias: [
      {
        find: /^@concordance-wiki\/plugin-([a-z0-9-]+)$/,
        replacement: `${plugins}$1/src/index.ts`,
      },
      { find: /^@concordance-wiki\/([a-z0-9-]+)$/, replacement: `${packages}$1/src/index.ts` },
    ],
  },
  test: {
    // The corpus builds of a few beforeAll hooks take more than the default ten seconds on a
    // loaded runner; the tests themselves keep the default budget.
    hookTimeout: 60_000,
    // A page loaded into the DOM of a test is read as markup: its scripts and stylesheets are
    // never fetched from the closed port the DOM would otherwise hit, and a script tag a test
    // injects loads silently; the test fires the outcome it wants on it.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    include: [
      "packages/*/test/**/*.test.ts",
      "plugins/*/test/**/*.test.ts",
      "presets/*/test/**/*.test.ts",
      "scripts/test/**/*.test.mjs",
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}", "plugins/*/src/**/*.ts", "presets/*/src/**/*.ts"],
      // The executable wrapper only wires process to main(); it is exercised by the pipeline, not by unit tests.
      exclude: ["packages/cli/src/bin.ts"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
