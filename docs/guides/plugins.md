# Plugins

The core of Concordance reads markdown and produces JSON. It depends on no office format and no system tool. Everything else is a plugin: format readers, the LibreOffice converter, contract importers, viewers, and later heavy projections and extra languages.

## Official plugins

| Package | Contributes | System dependency | Status |
|---|---|---|---|
| [`@concordance-wiki/plugin-reader-vtt`](../../plugins/reader-vtt/README.md) | reader for `.vtt` and `.srt` transcripts: cues, speakers, duration, language, HTML with addressable timecodes | none | available |
| `@concordance-wiki/plugin-reader-office` | metadata reader for `.docx`, `.pptx`, `.xlsx`, `.pdf` | none | planned |
| `@concordance-wiki/plugin-convert-libreoffice` | converter of `.docx`, `.pptx`, `.xlsx` to PDF with a fingerprint cache; thumbnails and text extraction later | LibreOffice | available |
| `@concordance-wiki/plugin-contract-openapi` | source of `endpoint` entities from OpenAPI 3.x | none | planned |
| `@concordance-wiki/plugin-contract-wsdl` | source of `endpoint` entities from WSDL | none | planned |
| `@concordance-wiki/plugin-viewer-pdf` | UI component: pdf.js viewer, thumbnail rail | none | planned |
| `@concordance-wiki/plugin-viewer-swagger` | UI component: Swagger UI and WSDL rendering | none | planned |

The `concordance` preset depends on all of them. Install the core packages alone when you want a build without any of this. The core never imports a plugin; a test walks its sources and its `package.json` to verify it.

## Declaring plugins

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - name: "@concordance-wiki/plugin-convert-libreoffice"
    options: { timeout_s: 120 }
```

An entry is a package name, or an object with the package name and its `options`. Plugins load in the declared order and register in a deterministic registry: every list the registry exposes (`plugins()`, `readers()`, `converters()`, `sources()`, `inferenceMethods()`, `checks()`, `projections()`, `uiComponents()`, `themes()`) follows the declaration order, and two runs on the same configuration give the same registry. The options are kept on the registration (`registrations()`); no contribution reads them yet.

Before a plugin is registered, the build runs `<command> --version` for every system dependency its manifest declares.

| Situation | Effect |
|---|---|
| a required dependency is missing | the plugin is not registered; finding [`W-PLUGIN-DISABLED`](../checks/W-PLUGIN-DISABLED.md), severity `warning`; the build continues |
| an `optional` dependency is missing | the plugin is registered; the same finding with severity `info` |
| the package has no default export returned by `definePlugin` | configuration error naming the package; the build stops |
| the manifest targets another `apiVersion` than the installed core | configuration error naming both versions; the build stops |
| the same plugin is declared twice | configuration error; the build stops |
| two plugins contribute the same reader extension, converter extension, source kind, inference method, check identifier, projection identifier or UI slot | configuration error naming both plugins; nothing is overridden silently |

Configuration errors are raised as `PluginLoadError`; a manifest that fails its schema is a `PluginDefinitionError` raised by `definePlugin` when the package is imported. Both carry a message that names the plugin and what is wrong.

## Writing a plugin

A plugin is a package whose default export is the manifest returned by `definePlugin`, validated by [`schemas/plugin.schema.json`](../../packages/core/schemas/plugin.schema.json): a name, a version, the `apiVersion` it targets, its system dependencies and its contributions. The functions of the contributions are not part of the schema; only the data around them is validated.

```ts
import { definePlugin } from "@concordance-wiki/core";

export default definePlugin({
  name: "@example/plugin-reader-csv",
  version: "0.1.0",
  apiVersion: "1",
  systemDependencies: [{ name: "csv toolkit", check: "csvtool", optional: true }],
  contributes: {
    readers: [{ extensions: [".csv"], read: readCsv }],
  },
});
```

A manifest names at least one contribution point. `definePlugin` throws when the manifest is invalid, listing every issue with its path, the value received and what was expected, and returns the same object marked so that the registry recognises it. The example under [`fixtures/plugins/example`](../../fixtures/plugins/example/index.mjs) is the smallest plugin that touches every contribution point.

### Contribution points

| Point | Manifest key | Data validated | Runtime part |
|---|---|---|---|
| `reader` | `readers` | `extensions`, each starting with `.` | `read({ path, payload: { bytes } }) → { metadata, text }` |
| `converter` | `converters` | `extensions`, `produces` among `pdf`, `thumbnails`, `text` | `convert(input) → Promise<{ representations, findings }>` |
| `source` | `sources` | `kind` | `load(input) → Promise<{ entities }>` |
| `inference method` | `inferenceMethods` | `method`, lowercase identifier | `infer(input) → { links }` |
| `check` | `checks` | `id` (`E-`, `W-` or `I-`), `severity`, `description`, `remediation`, `documentation` URL | `run(input) → findings[]` |
| `projection` | `projections` | `id`, lowercase identifier | `render(input) → { html, json }` |
| `ui component` | `uiComponents` | `slot`, `bundle` | none: the site loads the bundle on demand |
| `theme` | `themes` | `name`, `tokens` (a `theme.yaml`), optional `stylesheet`, `assets` folder and `components` overrides by slot | none: the site copies the assets, loads the stylesheet after its own and renders the overridden slots with the theme's components |

The input of each runtime part carries a `payload` whose shape is fixed by the story that consumes the contribution (a reader receives the raw bytes of the file as a `Uint8Array` and returns the metadata it extracted plus the full text, the material of recognition and search); the types exported by `@concordance-wiki/core` (`Reader`, `Converter`, `SourceProvider`, `InferenceMethod`, `CheckContribution`, `Projection`, `UiComponent`, `ThemeContribution`) say what is known today. Every contribution is a pure function of its inputs plus the injected context. A plugin never writes into a source repository. Checks contributed by a plugin obey the same identifier convention as the core checks and need a documentation page.

#### Converters

A converter receives `{ path, payload }` where the payload is typed (`ConverterPayload`):

| Field | Meaning |
|---|---|
| `bytes` | the source file |
| `sha256` | hex SHA-256 of the bytes, the key of the conversion cache |
| `cacheDirectory` | the pipeline cache (`conversion.cache`); the converter keeps its temporary and cached files under it, never next to the source |
| `options.timeoutMs`, `options.maxSizeBytes` | `conversion.timeout_s` and `conversion.max_size_mb`, converted |

It returns `{ representations, findings }`: one `{ path }` per produced representation (`pdf`, `thumbnails`, `text`), each a file under the cache that the pipeline reads later, and the findings of the conversion. A conversion that fails produces no representation and a [`W-CONV-FAILED`](../checks/W-CONV-FAILED.md) finding: the document remains a downloadable entity. A PDF without extractable text from a large source carries a [`W-CONV-SUSPECT`](../checks/W-CONV-SUSPECT.md) finding. The pipeline runs converters through a pool of `conversion.parallelism` workers and keeps the results in input order.

### System dependencies

`systemDependencies` lists the tools a plugin needs outside the package registry: a `name` shown in findings, the `check` command run with `--version` to detect it, and `optional: true` when the plugin can run without it. Keep the list to what the plugin actually calls.

### Versioning

The plugin API is versioned from the first release: `PLUGIN_API_VERSION` is `"1"`. A core release that changes the shape of any contribution bumps it; a plugin declares the version it targets in `apiVersion`, and the registry refuses any other. Official plugins are released together with the core through Changesets.
