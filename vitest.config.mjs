import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "plugins/*/test/**/*.test.ts",
      "presets/*/test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "plugins/*/src/**/*.ts", "presets/*/src/**/*.ts"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
