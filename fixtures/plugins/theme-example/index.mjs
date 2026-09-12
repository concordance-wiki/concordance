import { definePlugin } from "@concordance-wiki/core";

// A theme that overrides one slot; the others come from the default theme.
export default definePlugin({
  name: "@concordance-wiki/fixture-plugin-theme-example",
  version: "0.0.0",
  apiVersion: "1",
  contributes: {
    themes: [
      {
        name: "example",
        tokens: "./theme/theme.yaml",
        components: { Footer: "./theme/footer.mjs" },
      },
    ],
  },
});
