# Schemas

The JSON schemas of Concordance live with the package that validates them: [`packages/core/schemas/`](../packages/core/schemas/). They are published with `@concordance-wiki/core` and served at `https://concordance-wiki.github.io/concordance/schemas/`.

| Schema | Validates |
|---|---|
| `config.schema.json` | `concordance.yaml` |
| `lint.schema.json` | `concordance-lint.yaml`, at the root of a knowledge repository |
| `profile.schema.json` | `packages/profile/default.yaml` and project profiles |
| `model.schema.json` | `dist/model.json` |
| `lock.schema.json` | `concordance.lock.yaml` |
| `theme.schema.json` | `theme.yaml` |
| `plugin.schema.json` | the manifest returned by `definePlugin` |
| `language-pack.schema.json` | the `pack.yaml` of a language pack |
| `pseudonyms.schema.json` | `pseudonyms.yaml`, the pseudonymisation dictionary; read at build time, never published |
