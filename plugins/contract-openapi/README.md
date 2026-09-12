# @concordance-wiki/plugin-contract-openapi

Imports the OpenAPI 3.x contract an `api` note declares, so that the operations of the API come from the contract instead of being copied by hand into a note that would go stale.

## Contribution

One `source` of kind `openapi`, with no system dependency. For every `api` entity whose `contract` attribute names a contract, as a URL or as a path relative to the note, the source produces:

- one `endpoint` entity per operation (path × method among `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`), identified as `<api id>/<operationId>` slugified, or `<api id>/<method-path>` when the operation declares no identifier, titled `METHOD /path`, with `type_origin: contract` and the attributes `method`, `path`, `operation_id`, `summary` and `tags`; the operation identifier is an alias, so that a note that names it is recognised;
- one `exposes` link from the API to each endpoint, at the `contract_import` confidence of the profile (0.95), with a provenance that carries the contract location and the operation name;
- one candidate object per component schema the operations reference, offered under `candidates.objects` without being linked to anything: the author decides which ones deserve a note;
- one contract record with the title and the version the contract declares, the fingerprint of its bytes and the import date from the injected clock, recorded under `build.contracts` of the model and in the build log.

Paths are sorted and methods follow the fixed order above, so that two builds on the same contract give the same entities in the same order.

## Behaviour

- A `http://` or `https://` location is fetched through the `fetch` of the plugin context; without one, the build runs offline and the contract is reported as unreachable. Any other location is a path resolved from the folder of the API note inside its source, read through the injected file system.
- The cache key is the SHA-256 of the contract text: the contract is read on every build, and one whose bytes are unchanged is not parsed again; the extracted operations are kept under `<cache>/contracts/<sha256>.json`. Nothing is written next to the note.
- A contract that cannot be fetched (HTTP error, network failure, no network access), read (missing file) or parsed (neither JSON nor YAML, not an object, no `openapi` key, or a version other than 3.x) yields a [`W-CONTRACT-UNREACHABLE`](../../docs/checks/W-CONTRACT-UNREACHABLE.md) finding naming the reason; nothing is imported for that API, the other contracts are still imported and the build goes on. An unparsable contract is not cached, so that the next build reads it again.
- Two operations whose names slugify alike get numbered identifiers (`get-payment`, `get-payment-2`), in contract order.

## What is read, and what is not

The plugin reads `openapi`, `info.title`, `info.version`, the operations under `paths` (their `operationId`, `summary` and `tags`) and the `$ref` references reachable from their parameters, request body and responses, including the parameters declared at the path level. Local references (`#/components/...`) are resolved by the plugin itself, through parameters, request bodies and responses and into the schemas they name, transitively and once per reference; only `#/components/schemas/<name>` references become candidate objects.

Not read: remote references (`other.yaml#/...`, `https://...#/...`), which are left alone rather than fetched; `callbacks`, `webhooks`, `servers`, `security` and the schema contents themselves. Swagger 2.0 documents are refused with a finding.

JSON and YAML documents are both accepted. The YAML parser is the `yaml` package the core already depends on; a document starting with `{` is read by `JSON.parse` so that a JSON error is reported as such. No other dependency is added: OpenAPI needs no reference resolution library for what this plugin reads.

## Testing

Unit tests run the source through the plugin registry with an in-memory file system, a fixed clock and a `fetch` double; no test touches the network. A golden test imports the [example contract](../../docs/templates/openapi.example.json) of the API note template.
