import { definePlugin } from "@concordance-wiki/core";

// The smallest plugin that touches every contribution point; the functions return fixed values.
export default definePlugin({
  name: "@concordance-wiki/fixture-plugin-example",
  version: "0.0.0",
  apiVersion: "1",
  systemDependencies: [{ name: "git", check: "git" }],
  contributes: {
    readers: [
      {
        extensions: [".example"],
        read: (input) => ({ metadata: { path: input.path }, text: "example" }),
      },
    ],
    converters: [
      {
        extensions: [".example"],
        produces: ["text"],
        convert: (input) => Promise.resolve({ representations: { text: input.path } }),
      },
    ],
    sources: [{ kind: "example", load: (input) => Promise.resolve({ entities: [input.name] }) }],
    inferenceMethods: [{ method: "example", infer: () => ({ links: [] }) }],
    checks: [
      {
        id: "I-EXAMPLE-ALWAYS",
        severity: "info",
        description: "Reports once per run to show that plugin checks are called.",
        remediation: "Nothing to fix.",
        documentation: "https://example.invalid/checks/I-EXAMPLE-ALWAYS",
        run: () => [{ check: "I-EXAMPLE-ALWAYS", severity: "info", message: "example" }],
      },
    ],
    projections: [{ id: "example", render: () => ({ html: "<p>example</p>", json: {} }) }],
    uiComponents: [{ slot: "example", bundle: "./ui/example.js" }],
    themes: [
      {
        name: "example",
        tokens: "./theme/theme.yaml",
        stylesheet: "./theme/theme.css",
        assets: "./theme/assets",
        components: { Footer: "./theme/footer.js" },
      },
    ],
  },
});
