<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/core</h1>

<p align="center"><strong>The model, the schemas and the plugin API: what every other part of Concordance agrees on.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/core"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/core?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md">Writing a plugin</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/core/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance turns the markdown your team writes for the AI into a wiki for the humans: point it at your git repositories and every word of your business gets a page. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) for that. This package is the part of it every other part depends on: the shape of the model, the schemas of the configuration files, the deterministic identifiers, the injected file system, git and clock, and the API a plugin declares itself with. Install it alone to write a plugin, or to build on the engine.

## Quick start

```bash
npm install @concordance-wiki/core
```

The smallest plugin, a reader for `.log` files, declared with `definePlugin` and named from `concordance.yaml` under `plugins:`:

```ts
import { definePlugin } from "@concordance-wiki/core";

export default definePlugin({
  name: "concordance-plugin-reader-log",
  version: "0.1.0",
  apiVersion: "1",
  contributes: {
    readers: [
      {
        extensions: [".log"],
        read: (input) => ({ metadata: {}, text: new TextDecoder().decode(input.payload.bytes) }),
      },
    ],
  },
});
```

Reading and validating a configuration the way `concordance validate-config` does:

```ts
import { formatValidation, parseConfig } from "@concordance-wiki/core";
import { readFileSync } from "node:fs";

const validation = parseConfig(readFileSync("concordance.yaml", "utf8"));
for (const line of formatValidation(validation, "concordance.yaml")) console.log(line);
```

## What you get

- **The plugin API**: `definePlugin`, `loadPlugins`, `importPlugin` and the contribution points, readers, converters, sources, inference methods, checks, projections, UI components, themes, types.
- **The configuration, checked**: `parseConfig`, `validateConfig`, `formatValidation`, with the lock file of human decisions and the theme file, against the JSON schemas shipped under `schemas/`.
- **What a repository declares for the tool**: `readLintConfig`, `repositoryFiles`, `compileGitignore`, the files a build or a lint reads once the excluded globs and the `.gitignore` files apply.
- **Injected effects**: `FileSystem`, `GitClient`, `Clock` with their node and in-memory implementations, so that everything else stays pure and testable.
- **Deterministic identifiers**: `slugify`, `identifierFor`, `resolveDuplicates`, `pagePath`, `pageUrl`; two builds of the same sources name everything the same.
- **The model**: `Entity`, `Link`, `Provenance`, `Finding` with their canonical comparators, `assembleModel`, `serializeModel`, `parseModel`, `validateModel`, `toCypher`.
- **The build log**: `summarize`, `shouldFail`, `serializeBuildLog`, the counts per severity and per check and the verdict of `build.fail_on`.
- **Contracts and pseudonyms**: the contract cache the contract plugins share, and the pseudonymisation of transcripts and of the names a dictionary lists.

## Documentation

- [Writing a plugin](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md)
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Architecture](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/architecture.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/core/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

Configuration parsing and validation (`parseConfig`, `validateConfig`, `formatValidation`), the lock file of human decisions (`parseLock`, `validateLock` over `schemas/lock.schema.json`, the `LockFile` type), the schema reader (`readSchema`) and error describer (`describeSchemaError`), the lint configuration of a repository (`readLintConfig`, `parseLintConfig` over `schemas/lint.schema.json`) and the files a repository holds for the tool (`repositoryFiles`: the excluded globs and, through `compileGitignore` and `readGitignore`, the files git ignores are left out), the injected file system (`FileSystem`, `nodeFileSystem`, `memoryFileSystem`), the plugin API (`PLUGIN_API_VERSION`, `definePlugin`, `loadPlugins`, `importPlugin`, `commandExists`, the `types` contribution point listing the type modules of the plugins with `typeSlugOf` naming each after its folder), the schema of a type module (`schemas/type-module.schema.json`), the finding type with its canonical order (`Finding`, `compareFindings`; every finding carries a remediation) and the build log (`summarize`, `shouldFail`, `serializeBuildLog`): counts per severity and per check, the decisions of the lock file applied (`LockCounts`), the verdict driven by `build.fail_on`, and the stable JSON written to `dist/build.log.json`, deterministic identifiers (`slugify`, `identifierFor`, `resolveDuplicates`, `pagePath`, `pageUrl`), and the link model (`Link`, `Provenance`) mirroring `schemas/model.schema.json`, ordered by the canonical comparators (`compareLinks`, `compareProvenances`), the entity of the model (`Entity`, mirroring the `entities` block of `model.json`, `keyword: true` marking a keyword page without a note), the keyword counts of the build summary (`KeywordCounts`: pages published and expressions under the threshold, serialised only when the build computes them), and the canonical model itself: `assembleModel` sorts every block, `serializeModel` writes the canonical JSON of `dist/model.json`, `parseModel` and `validateModel` check a model against `schemas/model.schema.json` (`ModelError` carries the issues), and `toCypher` turns a model into a Cypher script; the contract loading the contract plugins share (`loadContracts` with a `ContractReader`, `declaredContracts`, `fingerprintOf`, the cache under `<cache>/contracts/`, the `ContractView` written next to the cached contract for the viewer of the API page); and pseudonymisation of transcripts (`loadPseudonymDictionary` over the published `pseudonyms.schema.json`, `pseudonymizeText`, `pseudonymizeSpeaker`, `pseudonymizeTranscript`, `transcriptsPublished`).

</details>
