import { definePlugin } from "@concordance-wiki/core";

// A theme that changes nothing but the tokens file: the name, logo, palette, radius,
// stylesheet and assets all come from theme.yaml; every slot keeps its default component.
export default definePlugin({
  name: "@concordance-wiki/fixture-plugin-theme-white-label",
  version: "0.0.0",
  apiVersion: "1",
  contributes: {
    themes: [{ name: "white-label", tokens: "./theme/theme.yaml" }],
  },
});
