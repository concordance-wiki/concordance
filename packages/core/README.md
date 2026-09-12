# @concordance-wiki/core

Model types, identifiers, canonical sorting, deterministic utilities and the plugin API. Ships the JSON schemas under `schemas/`.

Today: configuration parsing and validation (`parseConfig`, `validateConfig`, `formatValidation`), the schema reader (`readSchema`) and error describer (`describeSchemaError`), the injected file system (`FileSystem`, `nodeFileSystem`, `memoryFileSystem`) and the plugin API (`PLUGIN_API_VERSION`, `definePlugin`, `loadPlugins`, `importPlugin`, `commandExists`). See the [plugin guide](../../docs/guides/plugins.md).

Part of [Concordance](../../README.md).
