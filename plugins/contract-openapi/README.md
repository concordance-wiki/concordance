# @concordance-wiki/plugin-contract-openapi

A source plugin for Concordance that imports the OpenAPI 3.x contract an `api` note declares, so that the operations of the API come from the contract instead of being copied by hand into a note that would go stale. An integrator installs it next to `@concordance-wiki/cli` and declares it in `concordance.yaml`; it is not part of `@concordance-wiki/concordance`.

## Install

```bash
npm install --save-dev @concordance-wiki/plugin-contract-openapi
```

Then declare it in `concordance.yaml`:

```yaml
plugins:
  - "@concordance-wiki/plugin-contract-openapi"
```

## Use

An `api` note names its contract, as a path relative to the note or as a URL:

```markdown
---
type: api
protocol: rest
contract: ./model-query.openapi.json
---

# Model query API
```

The build then produces one `endpoint` entity per operation, an `exposes` link from the API to each at confidence 0.95, and the schemas the operations reference as candidate objects; the page of the API shows the contract viewer. A contract that cannot be fetched, read or parsed is reported as `W-CONTRACT-UNREACHABLE` and the build goes on.

## What it contains

- The plugin manifest, as the default export: one `source` contribution of kind `openapi`, no system dependency.
- `readOpenApi`: an OpenAPI 3.x document, JSON or YAML, read into its operations, referenced schemas and the view of the contract viewer.
- `openApiReader`, `loadContracts`: the `ContractReader` handed to the loader the core shares between the contract plugins, and that loader bound to it.
- `HTTP_METHODS`, `SOURCE_KIND`, `STYLE`: the fixed method order, `openapi` and `http`.

## Documentation

- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md), an API note declares its contract, and operation notes
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), declaring a plugin
- [W-CONTRACT-UNREACHABLE](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-CONTRACT-UNREACHABLE.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/contract-openapi/CHANGELOG.md)

## Inside

### Contribution

One `source` of kind `openapi`, with no system dependency. For every `api` entity whose `contract` attribute names a contract, as a URL or as a path relative to the note, the source produces:

- one `endpoint` entity per operation (path × method among `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`), identified as `<api id>/<operationId>` slugified, or `<api id>/<method-path>` when the operation declares no identifier, titled `METHOD /path`, with `type_origin: contract` and the attributes `method`, `path`, `operation_id`, `summary`, `tags` and `style: http`; the operation identifier is an alias, so that a note that names it is recognised;
- one `exposes` link from the API to each endpoint, at the `contract_import` confidence of the profile (0.95), with a provenance that carries the contract location and the operation name;
- one candidate object per component schema the operations reference, offered under `candidates.objects` without being linked to anything: the author decides which ones deserve a note;
- one contract record with the title and the version the contract declares, the fingerprint of its bytes and the import date from the injected clock, recorded under `build.contracts` of the model and in the build log;
- the view the contract viewer of the API page shows, written by the shared loader next to the cached contract: each operation with its parameters (name, location, requirement, type), the type of its request body and one entry per response with its status, description and body type; and the component schemas the operations reference, each with its description, its type when it is not an object, and its fields (name, type, requirement, description), the `allOf` parts merged. Nothing of it reaches the entities.

Paths are sorted and methods follow the fixed order above, so that two builds on the same contract give the same entities in the same order. An endpoint imported from an OpenAPI contract has the same shape as one imported by the WSDL plugin: only the protocol-specific attributes differ.

### Behaviour

- The loading is the one `@concordance-wiki/core` shares between the contract plugins (`loadContracts` with a `ContractReader`); this plugin brings the reader. A `http://` or `https://` location is fetched through the `fetch` of the plugin context; without one, the build runs offline and the contract is reported as unreachable. Any other location is a path resolved from the folder of the API note inside its source, read through the injected file system.
- The plugin decides on content whether a contract is its business: any text that is not an XML document is read as OpenAPI; an XML document is left to the WSDL plugin, without a finding.
- The cache key is the SHA-256 of the contract text: the contract is read on every build, and one whose bytes are unchanged is not parsed again; the extracted operations are kept under `<cache>/contracts/<sha256>.json`. Nothing is written next to the note.
- A contract that cannot be fetched (HTTP error, network failure, no network access), read (missing file) or parsed (neither JSON nor YAML, not an object, no `openapi` key, or a version other than 3.x) yields a `W-CONTRACT-UNREACHABLE` finding naming the reason; nothing is imported for that API, the other contracts are still imported and the build goes on. An unparsable contract is not cached, so that the next build reads it again.
- Two operations whose names slugify alike get numbered identifiers (`get-entity`, `get-entity-2`), in contract order.

### What is read, and what is not

The plugin reads `openapi`, `info.title`, `info.version`, the operations under `paths` (their `operationId`, `summary`, `tags`, `parameters`, `requestBody` and `responses`, the `application/json` media type preferred when several are declared) and the `$ref` references reachable from their parameters, request body and responses, including the parameters declared at the path level. Local references (`#/components/...`) are resolved by the plugin itself, through parameters, request bodies and responses and into the schemas they name, transitively and once per reference; only `#/components/schemas/<name>` references become candidate objects.

Of a schema, the viewer gets its `description`, its `properties` with their `type`, `$ref`, `items`, `enum`, `oneOf`, `anyOf` and `allOf` reduced to one type label each (`Entity`, `Link[]`, `string | null`), and its `required` list. Not read: remote references (`other.yaml#/...`, `https://...#/...`), which are left alone rather than fetched; `callbacks`, `webhooks`, `servers`, `security`, formats, constraints and examples. Swagger 2.0 documents are refused with a finding.

JSON and YAML documents are both accepted. The YAML parser is the `yaml` package the core already depends on; a document starting with `{` is read by `JSON.parse` so that a JSON error is reported as such. No other dependency is added: OpenAPI needs no reference resolution library for what this plugin reads.

### Testing

Unit tests run the source through the plugin registry with an in-memory file system, a fixed clock and a `fetch` double; no test touches the network. A golden test imports the example contract of the API note template, `docs/templates/openapi.example.json` in the repository.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
