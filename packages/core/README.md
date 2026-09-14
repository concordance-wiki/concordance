# @concordance-wiki/core

The engine of Concordance: the model types, the configuration, lock and theme schemas, the deterministic identifiers, the injected file system, git and clock, and the plugin API. A plugin author installs it to declare a plugin; every other package of the tool depends on it. An integrator who only builds a wiki installs `@concordance-wiki/concordance` instead.

## Install

```bash
npm install @concordance-wiki/core
```

## Use

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

## What it contains

- `definePlugin`, `PLUGIN_API_VERSION`, `loadPlugins`, `importPlugin`: the plugin manifest, its contribution points (readers, converters, sources, inference methods, checks, projections, UI components, themes, types) and the registry the command line builds from `plugins:`.
- `parseConfig`, `validateConfig`, `formatValidation`, `parseLock`, `validateLock`, `parseTheme`, `validateTheme`: the configuration, the lock file of human decisions and the theme file, checked against the JSON schemas shipped under `schemas/` (`readSchema`, `describeSchemaError`).
- `readLintConfig`, `parseLintConfig`, `repositoryFiles`, `compileGitignore`: what a knowledge repository declares for the tool in `concordance-lint.yaml`, and the files a build or a lint reads once the excluded globs and the `.gitignore` files apply.
- `FileSystem`, `nodeFileSystem`, `memoryFileSystem`, `GitClient`, `nodeGit`, `Clock`, `systemClock`, `fixedClock`: the injected effects, so that every other function is pure and testable.
- `slugify`, `identifierFor`, `resolveDuplicates`, `pagePath`, `pageUrl`: deterministic identifiers and page addresses.
- `Entity`, `Link`, `Provenance`, `Finding` and their canonical comparators (`compareEntities`, `compareLinks`, `compareProvenances`, `compareFindings`, `sortCanonically`): the model, mirroring `schemas/model.schema.json`.
- `assembleModel`, `serializeModel`, `parseModel`, `validateModel`, `toCypher`: the canonical `model.json` and its Cypher export.
- `summarize`, `shouldFail`, `serializeBuildLog`: the build log, the counts per severity and per check and the verdict of `build.fail_on`.
- `loadContracts`, `declaredContracts`, `fingerprintOf` and the contract cache: what the contract plugins share.
- `loadPseudonymDictionary`, `pseudonymizeText`, `pseudonymizeSpeaker`, `pseudonymizeTranscript`, `transcriptsPublished`: pseudonymisation of transcripts and of the names a dictionary lists.

## Documentation

- [Writing a plugin](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md)
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Architecture](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/architecture.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/core/CHANGELOG.md)

## Inside

Configuration parsing and validation (`parseConfig`, `validateConfig`, `formatValidation`), the lock file of human decisions (`parseLock`, `validateLock` over `schemas/lock.schema.json`, the `LockFile` type), the schema reader (`readSchema`) and error describer (`describeSchemaError`), the lint configuration of a repository (`readLintConfig`, `parseLintConfig` over `schemas/lint.schema.json`) and the files a repository holds for the tool (`repositoryFiles`: the excluded globs and, through `compileGitignore` and `readGitignore`, the files git ignores are left out), the injected file system (`FileSystem`, `nodeFileSystem`, `memoryFileSystem`), the plugin API (`PLUGIN_API_VERSION`, `definePlugin`, `loadPlugins`, `importPlugin`, `commandExists`, the `types` contribution point listing the type modules of the plugins with `typeSlugOf` naming each after its folder), the schema of a type module (`schemas/type-module.schema.json`), the finding type with its canonical order (`Finding`, `compareFindings`; every finding carries a remediation) and the build log (`summarize`, `shouldFail`, `serializeBuildLog`): counts per severity and per check, the decisions of the lock file applied (`LockCounts`), the verdict driven by `build.fail_on`, and the stable JSON written to `dist/build.log.json`, deterministic identifiers (`slugify`, `identifierFor`, `resolveDuplicates`, `pagePath`, `pageUrl`), and the link model (`Link`, `Provenance`) mirroring `schemas/model.schema.json`, ordered by the canonical comparators (`compareLinks`, `compareProvenances`), the entity of the model (`Entity`, mirroring the `entities` block of `model.json`, `keyword: true` marking a keyword page without a note), the keyword counts of the build summary (`KeywordCounts`: pages published and expressions under the threshold, serialised only when the build computes them), and the canonical model itself: `assembleModel` sorts every block, `serializeModel` writes the canonical JSON of `dist/model.json`, `parseModel` and `validateModel` check a model against `schemas/model.schema.json` (`ModelError` carries the issues), and `toCypher` turns a model into a Cypher script; the contract loading the contract plugins share (`loadContracts` with a `ContractReader`, `declaredContracts`, `fingerprintOf`, the cache under `<cache>/contracts/`, the `ContractView` written next to the cached contract for the viewer of the API page); and pseudonymisation of transcripts (`loadPseudonymDictionary` over the published `pseudonyms.schema.json`, `pseudonymizeText`, `pseudonymizeSpeaker`, `pseudonymizeTranscript`, `transcriptsPublished`).

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
