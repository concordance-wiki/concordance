<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/checks</h1>

<p align="center"><strong>Every check Concordance reports, catalogued once, so the build and the linter say the same thing.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/checks"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/checks?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/checks/README.md">The checks</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/checks/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance tells you where your corpus is weak: broken links, duplicate identifiers, words nobody defined, documents nobody summarised, and each finding comes with a severity, a remediation and a documentation page. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) for that. This package is the part of it that knows the checks: one catalogue entry per identifier, the registry that runs the checks on the model and enriches the findings of every pipeline step, so that the build and the linter report a finding the same way. Install it alone to build on the engine, or to look a check up from a plugin.

## Quick start

```bash
npm install @concordance-wiki/checks
```

```ts
import { catalogue, createRegistry, documentationUrl } from "@concordance-wiki/checks";

const registry = createRegistry();
registry.get("E-LINK-BROKEN")?.severity; // "error"
documentationUrl("E-LINK-BROKEN"); // "https://github.com/concordance-wiki/concordance/blob/main/docs/checks/E-LINK-BROKEN.md"
catalogue.length; // the number of documented checks
const findings = registry.enrich([{ check: "E-LINK-BROKEN", severity: "error", message: "checks/link-broken.md:3: target not found", path: "checks/link-broken.md", line: 3 }]);
findings[0]?.remediation; // completed from the catalogue
```

## What you get

- **One catalogue**: a `CheckDefinition` per documented identifier, with its default severity, family, description, remediation and documentation URL; a test holds the catalogue to the documentation, one entry per page.
- **One registry**: `createRegistry` merges the catalogue with the checks plugins contribute and refuses an identifier registered twice.
- **The same finding everywhere**: `registry.enrich` applies the `checks:` overrides of the configuration to the findings of every pipeline step, severity included.
- **Model checks**: `registry.run` runs every enabled check on a structural view of the model; `W-API-NOCONSUMER` and `W-API-CONSUMER-MISMATCH` are computed here.
- **A page for every check**: `documentationUrl` and `isCheckId`, the address of a check and the shape of its identifier.

## Documentation

- [The checks](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/README.md), one page per identifier
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `checks` block
- [Writing a plugin](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the `checks` contribution point
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/checks/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

The package holds the catalogue of every check documented under `docs/checks` of the repository, one `CheckDefinition` per identifier with its default severity, family, description, remediation and documentation URL (`documentationUrl(id)`), and `createRegistry(definitions?, contributed?)`, which merges the catalogue with the checks contributed by plugins and refuses an identifier registered twice. A check is a pure function `(input: CheckInput) => Finding[]` over a structural view of the model (entities, links, sources, profile). The checks whose data the model already carries are computed here: `W-API-NOCONSUMER` and `W-API-CONSUMER-MISMATCH`. The others are reported by a pipeline step (`W-SOURCE-UNREACHABLE` by ingestion, `E-ID-DUP` by identity resolution, `W-APP-MISSING`, `W-APP-UNKNOWN`, `W-DOMAIN-UNCLASSIFIED` and `W-DOMAIN-UNKNOWN` by the typing step that files every entity, `E-META-REL` and `I-REL-AMBIGUOUS` by the relation typing step, which alone knows the provenance behind a link, `W-PLUGIN-DISABLED` by the plugin loader, and so on) and only enriched here, so that no finding is ever reported twice. `registry.run(input, overrides)` runs every enabled check and applies the `checks:` overrides of the configuration; `registry.enrich(findings, overrides)` applies the same overrides to the findings of the pipeline steps and completes a missing remediation from the catalogue. Both return findings sorted canonically, and an override naming an unknown check throws a `CheckRegistryError`. The build calls `run` on the structural view of the finished model, plugin checks included, then `enrich` on the findings of every step; the linter calls `enrich` on the step findings it computes, so that a finding reads the same in both. A `CheckLink` may carry its provenance (method, path, line): `W-API-CONSUMER-MISMATCH` counts as a citation only a `serves` link read outside the API note, so that the `consumers` attribute and the `## Consumers` section of the API do not cite the API to itself, and reads both as declarations; a declared consumer is resolved as an identifier written in full or relative to the source of the API note.

</details>
