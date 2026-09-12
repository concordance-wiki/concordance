# Plugins

The core of Concordance reads markdown and produces JSON. It depends on no office format and no system tool. Everything else is a plugin: format readers, the LibreOffice converter, contract importers, viewers, and later heavy projections and extra languages.

## Official plugins

| Package | Contributes | System dependency | Status |
|---|---|---|---|
| [`@concordance-wiki/plugin-reader-vtt`](../../plugins/reader-vtt/README.md) | reader for `.vtt` and `.srt` transcripts: cues, speakers, duration, language, HTML with addressable timecodes | none | available |
| [`@concordance-wiki/plugin-reader-office`](../../plugins/reader-office/README.md) | metadata reader for `.docx`, `.pptx`, `.xlsx`, `.pdf`: title, author, subject, keywords, dates, page, word and slide counts, slide titles | none | available |
| `@concordance-wiki/plugin-convert-libreoffice` | converter of `.docx`, `.pptx`, `.xlsx` to PDF with a fingerprint cache; thumbnails and text extraction later | LibreOffice | available |
| [`@concordance-wiki/plugin-contract-openapi`](../../plugins/contract-openapi/README.md) | source of `endpoint` entities from the OpenAPI 3.x contract an API note declares, candidate objects from its schemas, cached by fingerprint | none | available |
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
| `source` | `sources` | `kind` | `load({ payload, context }) → Promise<{ entities, links, candidates, contracts, findings }>` |
| `inference method` | `inferenceMethods` | `method`, lowercase identifier | `infer(input) → { links }` |
| `check` | `checks` | `id` (`E-`, `W-` or `I-`), `severity`, `description`, `remediation`, `documentation` URL | `run(input) → findings[]` |
| `projection` | `projections` | `id`, lowercase identifier | `render(input) → { html, json }` |
| `ui component` | `uiComponents` | `slot`, `bundle` | none: the site loads the bundle on demand |
| `theme` | `themes` | `name`, `tokens` (a `theme.yaml`), optional `stylesheet`, `assets` folder and `components` overrides by slot | none: the site copies the assets, loads the stylesheet in the `project` layer and renders the overridden slots with the theme's components |

The input of each runtime part carries a `payload` whose shape is fixed by the story that consumes the contribution (a reader receives the raw bytes of the file as a `Uint8Array` and returns the metadata it extracted plus the full text, the material of recognition and search); the types exported by `@concordance-wiki/core` (`Reader`, `Converter`, `SourceProvider`, `InferenceMethod`, `CheckContribution`, `Projection`, `UiComponent`, `ThemeContribution`) say what is known today. Every contribution is a pure function of its inputs plus the injected context: a `PluginContext` carries the file system, the clock and, when the build has network access, a `fetch` function; a contribution never reads the clock or the network on its own. A plugin never writes into a source repository. Checks contributed by a plugin obey the same identifier convention as the core checks and need a documentation page.

#### Sources

A source receives `{ payload, context }` where the payload is typed (`SourcePayload`):

| Field | Meaning |
|---|---|
| `entities` | the entities read from the notes; a source picks the ones it enriches |
| `roots` | the absolute folder of each declared source by name, against which the paths written in notes resolve |
| `cacheDirectory` | the pipeline cache (`conversion.cache`); a source keeps what it fetched under it |
| `confidence` | the confidence of each provenance method, as the profile declares it |

and the context (`PluginContext`) carries `fs`, `clock` and an optional `fetch`, absent when the build runs offline. It returns `{ entities, links, candidates, contracts, findings }`: the entities it produces with `type_origin: contract`, the links that attach them with their provenance, the candidate objects it offers without linking them, one record per contract it read (title, version, fingerprint, import date) and its findings. A contract that cannot be read is a [`W-CONTRACT-UNREACHABLE`](../checks/W-CONTRACT-UNREACHABLE.md) finding; the other contracts are still imported.

#### Converters

A converter receives `{ path, payload }` where the payload is typed (`ConverterPayload`):

| Field | Meaning |
|---|---|
| `bytes` | the source file |
| `sha256` | hex SHA-256 of the bytes, the key of the conversion cache |
| `cacheDirectory` | the pipeline cache (`conversion.cache`); the converter keeps its temporary and cached files under it, never next to the source |
| `options.timeoutMs`, `options.maxSizeBytes` | `conversion.timeout_s` and `conversion.max_size_mb`, converted |

It returns `{ representations, findings }`: one `{ path }` per produced representation (`pdf`, `thumbnails`, `text`), each a file under the cache that the pipeline reads later, and the findings of the conversion. A conversion that fails produces no representation and a [`W-CONV-FAILED`](../checks/W-CONV-FAILED.md) finding: the document remains a downloadable entity. A PDF without extractable text from a large source carries a [`W-CONV-SUSPECT`](../checks/W-CONV-SUSPECT.md) finding. The pipeline runs converters through a pool of `conversion.parallelism` workers and keeps the results in input order.

#### Readers

A reader receives a `ReaderInput`: the `path` of the file relative to its source, used to pick the format and to name the file in errors, and `payload.bytes`, its raw content as a `Uint8Array`. It returns a `ReaderOutput`: `metadata`, a flat record of the native properties of the resource (title, author, subject, keywords, `created` and `modified` dates as ISO 8601 strings, counts), and `text`, the readable content, empty when the format has no extractable text yet. A reader is synchronous and pure: it reads nothing but the bytes it is given, never git, the file system or the clock, so the dates it returns are the document's own and stay distinct from the commit date the ingested file carries. When the bytes cannot be read it throws a plain `Error` whose message names the file; the pipeline turns that failure into a finding. Personal data such as authors is returned raw: pseudonymisation applies downstream, on the model, when it is enabled.

#### Themes

A theme names a `theme.yaml`, an optional stylesheet and assets folder, and `components`: a map from slot name to the path of a module, relative to the plugin package, whose default export is a Preact component receiving the view model of that slot. Slots the theme does not name keep the default component; when several plugins override the same slot, the last one declared wins. Slot names and view models are in the [theming guide](theming.md).

```js
import { definePlugin } from "@concordance-wiki/core";

export default definePlugin({
  name: "@example/plugin-theme-corporate",
  version: "0.1.0",
  apiVersion: "1",
  contributes: {
    themes: [
      {
        name: "corporate",
        tokens: "./theme/theme.yaml",
        stylesheet: "./theme/theme.css",
        components: { Footer: "./theme/footer.js", Header: "./theme/header.js" },
      },
    ],
  },
});
```

```js
// theme/footer.js
import { h } from "preact";

export default function Footer({ version, generatedAt, links }) {
  return h("footer", { class: "site-footer" }, `version ${version}, built on ${generatedAt}`);
}
```

The example under [`fixtures/plugins/theme-example`](../../fixtures/plugins/theme-example/index.mjs) overrides the footer alone and is rendered end to end by the site tests. An override for a name that is not a slot, or a module whose default export is not a function, is a `ThemeResolutionError` naming the plugin and the theme.

### System dependencies

`systemDependencies` lists the tools a plugin needs outside the package registry: a `name` shown in findings, the `check` command run with `--version` to detect it, and `optional: true` when the plugin can run without it. Keep the list to what the plugin actually calls.

### Versioning

The plugin API is versioned from the first release: `PLUGIN_API_VERSION` is `"1"`. A core release that changes the shape of any contribution bumps it; a plugin declares the version it targets in `apiVersion`, and the registry refuses any other. Official plugins are released together with the core through Changesets.
