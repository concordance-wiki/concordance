# @concordance-wiki/checks

The catalogue of every check Concordance reports, with its severity, family, remediation and documentation page, and the registry that runs the model checks and enriches the findings of the pipeline steps so that the build and the linter read the same. Installed by `@concordance-wiki/cli`; you need it only to build on the engine, to look a check up from a plugin for instance.

## Install

```bash
npm install @concordance-wiki/checks
```

## Use

```ts
import { catalogue, createRegistry, documentationUrl } from "@concordance-wiki/checks";

const registry = createRegistry();
registry.get("E-LINK-BROKEN")?.severity; // "error"
documentationUrl("E-LINK-BROKEN"); // "https://github.com/concordance-wiki/concordance/blob/main/docs/checks/E-LINK-BROKEN.md"
catalogue.length; // the number of documented checks
const findings = registry.enrich([{ check: "E-LINK-BROKEN", severity: "error", message: "checks/link-broken.md:3: target not found", path: "checks/link-broken.md", line: 3 }]);
findings[0]?.remediation; // completed from the catalogue
```

## What it contains

- `catalogue`: one `CheckDefinition` per documented check identifier, with its default severity, family, description, remediation and documentation URL.
- `createRegistry(definitions?, contributed?)`: the catalogue merged with the checks plugins contribute, an identifier registered twice refused; `registry.run` runs every enabled check on a structural view of the model and `registry.enrich` applies the `checks:` overrides of the configuration to the findings of the pipeline steps.
- `documentationUrl`, `isCheckId`, `DOCUMENTATION_BASE_URL`: the page of a check and the shape of its identifier.
- `apiWithoutConsumer`, `apiConsumerMismatch`: the two checks computed here, `W-API-NOCONSUMER` and `W-API-CONSUMER-MISMATCH`.
- `Check`, `CheckInput`, `CheckEntity`, `CheckLink`, `CheckSource`: the structural view a check reads.

## Documentation

- [The checks](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/README.md), one page per identifier
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `checks` block
- [Writing a plugin](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the `checks` contribution point
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/checks/CHANGELOG.md)

## Inside

The package holds the catalogue of every check documented under `docs/checks` of the repository, one `CheckDefinition` per identifier with its default severity, family, description, remediation and documentation URL (`documentationUrl(id)`), and `createRegistry(definitions?, contributed?)`, which merges the catalogue with the checks contributed by plugins and refuses an identifier registered twice. A check is a pure function `(input: CheckInput) => Finding[]` over a structural view of the model (entities, links, sources, profile). The checks whose data the model already carries are computed here: `W-API-NOCONSUMER` and `W-API-CONSUMER-MISMATCH`. The others are reported by a pipeline step (`W-SOURCE-UNREACHABLE` by ingestion, `E-ID-DUP` by identity resolution, `W-APP-MISSING`, `W-APP-UNKNOWN`, `W-DOMAIN-UNCLASSIFIED` and `W-DOMAIN-UNKNOWN` by the typing step that files every entity, `E-META-REL` and `I-REL-AMBIGUOUS` by the relation typing step, which alone knows the provenance behind a link, `W-PLUGIN-DISABLED` by the plugin loader, and so on) and only enriched here, so that no finding is ever reported twice. `registry.run(input, overrides)` runs every enabled check and applies the `checks:` overrides of the configuration; `registry.enrich(findings, overrides)` applies the same overrides to the findings of the pipeline steps and completes a missing remediation from the catalogue. Both return findings sorted canonically, and an override naming an unknown check throws a `CheckRegistryError`. The build calls `run` on the structural view of the finished model, plugin checks included, then `enrich` on the findings of every step; the linter calls `enrich` on the step findings it computes, so that a finding reads the same in both. A `CheckLink` may carry its provenance (method, path, line): `W-API-CONSUMER-MISMATCH` counts as a citation only a `serves` link read outside the API note, so that the `consumers` attribute and the `## Consumers` section of the API do not cite the API to itself, and reads both as declarations; a declared consumer is resolved as an identifier written in full or relative to the source of the API note.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
