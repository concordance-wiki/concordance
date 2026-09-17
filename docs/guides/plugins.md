# Plugins

The core of Concordance reads markdown and produces JSON. It depends on no office format and no system tool. Everything else is a plugin: format readers, the LibreOffice converter, contract importers, viewers, and later heavy projections and extra languages.

## Official plugins

| Package | Contributes | System dependency | Status |
|---|---|---|---|
| [`@concordance-wiki/plugin-reader-vtt`](../../plugins/reader-vtt/README.md) | reader for `.vtt` and `.srt` transcripts: cues, speakers, duration, language, HTML with addressable timecodes | none | available |
| [`@concordance-wiki/plugin-reader-office`](../../plugins/reader-office/README.md) | metadata reader for `.docx`, `.pptx`, `.xlsx`, `.pdf`: title, author, subject, keywords, dates, page, word and slide counts, slide titles | none | available |
| [`@concordance-wiki/plugin-convert-libreoffice`](../../plugins/convert-libreoffice/README.md) | converter of `.docx`, `.pptx`, `.xlsx` to PDF with a fingerprint cache, and of `.pdf` sources kept as they are; both produce the text of every page of the PDF, the single extraction path of the tool; thumbnails later | LibreOffice | available |
| [`@concordance-wiki/plugin-contract-openapi`](../../plugins/contract-openapi/README.md) | source of `endpoint` entities from the OpenAPI 3.x contract an API note declares, candidate objects from its schemas, cached by fingerprint | none | available |
| [`@concordance-wiki/plugin-contract-wsdl`](../../plugins/contract-wsdl/README.md) | source of `endpoint` entities from the WSDL 1.1 or 2.0 contract an API note declares, candidate objects from its XSD types, cached by fingerprint | none | available |
| `viewer-pdf` (shipped with the default theme of `@concordance-wiki/site`, not a separate package) | pdf.js viewer loaded on demand from the page of a document: page navigation, zoom, a find box over the extracted text, a rail of positions captioned by their first line; image thumbnails come with the converter's thumbnail output | none | available |
| `viewer-contract` (shipped by `@concordance-wiki/site`, no package to install) | UI component: the contract viewer of the `api` page, a purpose-built island rendering the operations and schemas of an imported OpenAPI or WSDL contract from a JSON fragment, loaded on demand | none | available |
| `@concordance-wiki/plugin-viewer-swagger` | UI component: Swagger UI and WSDL rendering | none | planned |

The `@concordance-wiki/concordance` preset depends on all of them. Install the core packages alone when you want a build without any of this. The core never imports a plugin; a test walks its sources and its `package.json` to verify it.

## Declaring plugins

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - name: "@concordance-wiki/plugin-convert-libreoffice"
    options: { timeout_s: 120 }
```

An entry is a package name, a path to a module starting with `.` or `/` (`./plugins/theme/index.js`, resolved against the folder of `concordance.yaml`, by `build`, `render`, `init --templates` and `gallery` alike), or an object with the name and its `options`. The command line resolves the name from its own package, which depends on every shipped plugin: an installation finds them hoisted next to it, a checkout of the repository finds the workspace packages, and a name it cannot resolve is imported as written, so that a plugin installed next to the project loads the same way. Plugins load in the declared order and register in a deterministic registry: every list the registry exposes (`plugins()`, `readers()`, `converters()`, `sources()`, `inferenceMethods()`, `checks()`, `projections()`, `uiComponents()`, `themes()`) follows the declaration order, and two runs on the same configuration give the same registry. The options are kept on the registration (`registrations()`); no contribution reads them yet.

Before a plugin is registered, the build runs `<command> --version` for every system dependency its manifest declares.

| Situation | Effect |
|---|---|
| a required dependency is missing | the plugin is not registered; finding [`W-PLUGIN-DISABLED`](../checks/W-PLUGIN-DISABLED.md), severity `warning`; the build continues |
| an `optional` dependency is missing | the plugin is registered; the same finding with severity `info` |
| the package has no default export returned by `definePlugin` | configuration error naming the package; the build stops |
| the manifest targets another `apiVersion` than the installed core | configuration error naming both versions; the build stops |
| the same plugin is declared twice | configuration error; the build stops |
| two plugins contribute the same reader extension, converter extension, source kind, inference method, check identifier, projection identifier, UI slot, theme name or type slug | configuration error naming both plugins; nothing is overridden silently |

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
| `reader` | `readers` | `extensions`, each starting with `.` | `read({ path, payload: { bytes } }) → { metadata, text, units? }`, optionally `rewrite(input, substitution) → Uint8Array` |
| `converter` | `converters` | `extensions`, `produces` among `pdf`, `thumbnails`, `text` | `convert(input) → Promise<{ representations, findings }>` |
| `source` | `sources` | `kind` | `load({ payload, context }) → Promise<{ entities, links, candidates, contracts, findings }>` |
| `inference method` | `inferenceMethods` | `method`, lowercase identifier | `infer(input) → { links }` |
| `check` | `checks` | `id` (`E-`, `W-` or `I-`), `severity`, `description`, `remediation`, `documentation` URL | `run(input) → findings[]` |
| `projection` | `projections` | `id`, lowercase identifier | `render(input) → { html, json }` |
| `ui component` | `uiComponents` | `slot`, `bundle` | none: the site bundles the entry as an island named after the slot and loads it on demand |
| `theme` | `themes` | `name`, `tokens` (a `theme.yaml`), optional `stylesheet`, `assets` folder and `components` overrides by slot | none: the site copies the assets, loads the stylesheet in the `project` layer and renders the overridden slots with the theme's components |
| `type` | `types` | `path`, the folder of a type module relative to the package, whose name is the type slug | none: the build reads the module and merges it into the profile before the project profile; `init --templates` copies its template; the site renders its components |

The input of each runtime part carries a `payload` whose shape is fixed by the story that consumes the contribution (a reader receives the raw bytes of the file as a `Uint8Array` and returns the metadata it extracted plus the full text, the material of recognition and search); the types exported by `@concordance-wiki/core` (`Reader`, `Converter`, `SourceProvider`, `InferenceMethod`, `CheckContribution`, `Projection`, `UiComponent`, `ThemeContribution`) say what is known today. Every contribution is a pure function of its inputs plus the injected context: a `PluginContext` carries the file system, the clock and, when the build has network access, a `fetch` function; a contribution never reads the clock or the network on its own. A plugin never writes into a source repository. Checks contributed by a plugin obey the same identifier convention as the core checks and need a documentation page.

#### Sources

A source receives `{ payload, context }` where the payload is typed (`SourcePayload`):

| Field | Meaning |
|---|---|
| `entities` | the entities read from the notes; a source picks the ones it enriches |
| `roots` | the absolute folder of each declared source by name, against which the paths written in notes resolve |
| `cacheDirectory` | the pipeline cache (`conversion.cache`); a source keeps what it fetched under it |
| `confidence` | the confidence of each provenance method, as the profile declares it |

and the context (`PluginContext`) carries `fs`, `clock` and an optional `fetch`, absent when the build runs offline; the payload also carries `dates`, when every ingested file last changed by source name and path, so that a source dates what it reads next to the notes by the history of the repository rather than by the clock of the build. It returns `{ entities, links, candidates, contracts, findings }`: the entities it produces with `type_origin: contract`, the links that attach them with their provenance, the candidate objects it offers without linking them, one record per contract it read (title, version, fingerprint, import date, the operation names in contract order and, for a contract read as a file, its last change) and its findings. A contract that cannot be read is a [`W-CONTRACT-UNREACHABLE`](../checks/W-CONTRACT-UNREACHABLE.md) finding; the other contracts are still imported.

The contract plugins share the loading: `@concordance-wiki/core` exports `loadContracts(input, reader)`, which finds the `api` entities that declare a `contract`, fetches or reads the text once, caches the extracted contract by the SHA-256 of the text, turns the reader's operations into `endpoint` entities, `exposes` links, candidate objects and a contract record, and reports what it could not read. A plugin only writes a `ContractReader`: `accepts(text)` decides on content whether the text is its format (an OpenAPI document is anything that is not XML; a WSDL is an XML document whose root is `definitions` or `description`), `read(text, location)` extracts what the plugin keeps, `format(contract)` names its format with the version the document declares (`openapi 3.1`, `wsdl 1.1`), which the contract record carries and the API page shows, `cacheVersion` names the version of the shape `read` extracts (`1` when absent), so that a contract cached by a previous version of the plugin is read again rather than served with a shape the plugin no longer produces, `operations(contract)` maps it to the common operation shape (`name`, `title`, `aliases`, `summary`, `attributes`, `objects`, and for the viewer `parameters`, `request` and `responses`), and the optional `schemas(contract)` describes the schemas or types the operations reference as `{ name, description?, type?, fields: { name, type, required, description? }[] }`. Every plugin sees every declared contract and leaves the ones it does not accept alone, so the rest of the chain does not know which format an endpoint came from: the attributes carry `operation_id`, `summary` and `style` (`http` or `soap`) whatever the format, then the format's own keys. What the viewer shows never reaches the entities: at every load the loader writes a `ContractView` (`title`, `version`, `operations`, `schemas`) next to the cached contract, under `contracts/<fingerprint>.view.json`, and the build copies it as the fragment of the API page.

The imported operations then meet the operation notes written by hand: `@concordance-wiki/inference` exports `attachOperations({ entities, links, profile, normalize })`, which runs after the sources step and before the mention scan. It matches every hand-written `endpoint` note to an operation of its API on the `operation_id` of the frontmatter, then on the `method` and `path` pair (or `port` and title for SOAP), then on the title in comparison form, and merges the pair into the note: the note keeps its identifier, its markdown and its frontmatter, takes the contract attributes it does not set, lists the contract as a representation `{ kind: "contract", path, operation }` next to its own file and names the rung in `grouped_by`; the `exposes` link now points at the note and the imported operation disappears as a separate entity. An operation left without a note keeps its contract properties and its own page, and the API page flags it as having no note yet. An ambiguous match is a [`W-OPERATION-AMBIGUOUS`](../checks/W-OPERATION-AMBIGUOUS.md) finding and attaches nothing; a note that names an API with a contract and matches nothing is a [`W-OPERATION-UNMATCHED`](../checks/W-OPERATION-UNMATCHED.md) finding. The plugins are not involved: they produce operations of one shape and the matching reads that shape.

#### UI components

A UI component is an island: `slot` names it (the `data-island` of the element the page serves, `contract-viewer` for instance) and `bundle` is the path of its hydration entry, relative to the plugin package, which the site bundles with esbuild next to its own islands under `assets/`. The theme resolution collects the UI components of every registration; the site build bundles them after the default islands, and a slot the default theme already ships keeps the default entry. The registry refuses two contributions of the same slot, so a plugin cannot take a built-in viewer over silently.

The default theme ships its own UI components through the same contribution point: `@concordance-wiki/site` exports `defaultThemeManifest()`, a manifest named `@concordance-wiki/site` that contributes the `contract-viewer` slot, and the commands register it as a built-in ahead of the declared plugins (`builtin` in the loader dependencies), so that `uiComponents()` of the registry lists the viewer like any plugin component. The viewer is described in the [theming guide](theming.md#the-contract-viewer); the plugin table lists it as `viewer-contract`. A configuration never declares `@concordance-wiki/site` under `plugins:`.

#### Converters

A converter receives `{ path, payload }` where the payload is typed (`ConverterPayload`):

| Field | Meaning |
|---|---|
| `bytes` | the source file |
| `sha256` | hex SHA-256 of the bytes, the key of the conversion cache |
| `cacheDirectory` | the pipeline cache (`conversion.cache`); the converter keeps its temporary and cached files under it, never next to the source |
| `options.timeoutMs`, `options.maxSizeBytes` | `conversion.timeout_s` and `conversion.max_size_mb`, converted |

It returns `{ representations, findings }`: one `{ path }` per produced representation (`pdf`, `thumbnails`, `text`), each a file under the cache that the pipeline reads later, and the findings of the conversion. The `text` representation is a JSON file `{ "pages": string[] }`, one entry per page of the PDF in page order: the pipeline reads it as the only text of the document, whatever its reader said, so that the text of an office document always comes from its PDF and never from its own format. A conversion that fails produces no representation and a [`W-CONV-FAILED`](../checks/W-CONV-FAILED.md) finding: the document remains a downloadable entity, without text, and counts for `build.fail_on.unconverted_max`. A PDF without extractable text from a large source carries a [`W-CONV-SUSPECT`](../checks/W-CONV-SUSPECT.md) finding. The pipeline runs converters through a pool of `conversion.parallelism` workers and keeps the results in input order; a source declaring `convert: false` skips them.

The documents step of the build is where readers and converters meet: every file of a source that is not a note and whose extension a reader or a converter accepts becomes a `document` entity (or whatever the source rules say, `ext` matches included), identified by its path with its extension, titled by the `title` of its metadata or its file name, carrying the rest of the metadata as attributes. Its positions, the pages of a PDF, the slides of a deck (`.pptx`) or the cues of a transcript, are what the scan reads, one paragraph each: a mention in a document cites `page 3`, `slide 3` or a timecode where a mention in a note cites a line. The twin reconciliation compares documents with notes (base name, the reader's `title` against the heading of the note, the extracted text), so a deck and the note written about it become one entity carrying both representations; a document left without a markdown representation is a [`W-DOC-NOMD`](../checks/W-DOC-NOMD.md) finding, listed on the to-do page.

#### Readers

A reader receives a `ReaderInput`: the `path` of the file relative to its source, used to pick the format and to name the file in errors, and `payload.bytes`, its raw content as a `Uint8Array`. It returns a `ReaderOutput`: `metadata`, a flat record of the native properties of the resource (title, author, subject, keywords, `created` and `modified` dates as ISO 8601 strings, counts), `text`, the readable content, empty when the format has no extractable text, and optionally `units`, the same text cut into the addressable positions of the format, each `{ label, text, anchor?, speaker? }`: the transcript reader gives one per speaker turn, labelled by its timecode, named after its speaker when the cue names one and anchored like its HTML rendering, so that a mention in a transcript cites `00:12:05` and the page of a meeting writes who spoke. The pipeline reads the text and the units of a format no converter accepts; for a format a converter accepts, the text comes from the PDF. A reader is synchronous and pure: it reads nothing but the bytes it is given, never git, the file system or the clock, so the dates it returns are the document's own and stay distinct from the commit date the ingested file carries. When the bytes cannot be read it throws a plain `Error` whose message names the file; the pipeline turns that failure into a finding. Personal data such as authors is returned raw: pseudonymisation applies downstream, on the units and the metadata, when it is enabled.

A reader of transcripts also implements `rewrite(input, substitution)`: the same `ReaderInput`, and a `TextSubstitution` with `text(text)` and `speaker(name)`, two functions the pipeline builds from the pseudonymisation dictionary. It returns the file again as bytes, in its own format, every text and every speaker passed through the substitution, timecodes and structure kept, comments and anything the parser did not read dropped, since a comment may name someone. That file is what the site offers for download under pseudonymisation; the raw file is never copied. The VTT reader writes VTT and SRT back this way. A reader that yields units with speakers but no `rewrite` sees its transcripts withheld from the site with [`W-PRIVACY-WITHHELD`](../checks/W-PRIVACY-WITHHELD.md) when pseudonymisation is enabled.

#### Themes

A theme names a `theme.yaml` as `tokens`, an optional stylesheet and assets folder, and `components`: a map from slot name to the path of a module, relative to the plugin package, whose default export is a Preact component receiving the view model of that slot. Slots the theme does not name keep the default component; when several plugins override the same slot, the last one declared wins, and the `tokens` of the last theme apply unless the project has a `theme.yaml` of its own. Slot names, view models and every key of `theme.yaml` are in the [theming guide](theming.md).

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

#### Types

A plugin declares the types it brings as type modules, one folder each (`types: [{ path: "./types/runbook" }]`), in the format the [adding a type guide](adding-a-type.md) describes: `type.yaml`, `messages/<language>.json`, `template.md`, optionally `schema.json` and `components/`. The registry lists them in declaration order (`types()`, each with its plugin and slug) and refuses two plugins bringing the same slug. The build reads every module from its package once the plugins are loaded and merges them into the profile before the project's own `types_dir` modules and before the keys of `profile.yaml`; a module of a type the default profile declares is a configuration error, since a core type is extended through `profile.yaml`, and a module that does not validate stops the build with the file and the key at fault. `concordance init --templates` copies the template of every type the declared plugins contribute next to the core ones, and the site renders the pages of the type with the components the module ships, as the [theming guide](theming.md#rendering-per-type) says. The example plugin contributes a `runbook` type, a procedure for operating Concordance, with a page of its own.

### System dependencies

`systemDependencies` lists the tools a plugin needs outside the package registry: a `name` shown in findings, the `check` command run with `--version` to detect it, and `optional: true` when the plugin can run without it. Keep the list to what the plugin actually calls.

### Versioning

The plugin API is versioned from the first release: `PLUGIN_API_VERSION` is `"1"`. A core release that changes the shape of any contribution bumps it; a plugin declares the version it targets in `apiVersion`, and the registry refuses any other. Official plugins are released together with the core through Changesets.
