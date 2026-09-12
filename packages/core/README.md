# @concordance-wiki/core

Model types, identifiers, canonical sorting, deterministic utilities and the plugin API. Ships the JSON schemas under `schemas/`.

Today: configuration parsing and validation (`parseConfig`, `validateConfig`, `formatValidation`), the schema reader (`readSchema`) and error describer (`describeSchemaError`), the injected file system (`FileSystem`, `nodeFileSystem`, `memoryFileSystem`), the plugin API (`PLUGIN_API_VERSION`, `definePlugin`, `loadPlugins`, `importPlugin`, `commandExists`; see the [plugin guide](../../docs/guides/plugins.md)), the finding type with its canonical order (`Finding`, `compareFindings`; every finding carries a remediation) and the build log (`summarize`, `shouldFail`, `serializeBuildLog`): counts per severity and per check, the verdict driven by `build.fail_on`, and the stable JSON written to `dist/build.log.json`, deterministic identifiers (`slugify`, `identifierFor`, `resolveDuplicates`, `pagePath`, `pageUrl`), and the link model (`Link`, `Provenance`) mirroring `schemas/model.schema.json`, ordered by the canonical comparators (`compareLinks`, `compareProvenances`).

Part of [Concordance](../../README.md).
