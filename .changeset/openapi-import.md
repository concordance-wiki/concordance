---
"@concordance-wiki/plugin-contract-openapi": minor
"@concordance-wiki/core": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/profile": minor
---

Add the `contract-openapi` plugin: the OpenAPI 3.x contract an `api` note declares through its `contract` attribute, as a URL or a path, is read (JSON or YAML) and produces one `endpoint` entity per operation with its method, path, summary and operation identifier, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the referenced schemas as candidate objects, and a record of the contract version with its import date; the extracted contract is cached by the SHA-256 of its bytes and an unreachable or unparsable contract yields `W-CONTRACT-UNREACHABLE` without stopping the build. The core types the source contribution (`SourcePayload`, `PluginContext` with `fs`, `clock` and an optional `fetch`, `SourceOutput` with entities, links, candidates, contracts and findings), records `contracts` in the build log and in the model schema (`build.contracts`, `candidates.objects`); the checks catalogue gains `W-CONTRACT-UNREACHABLE`; the default profile gains the `exposes` relation from `api` to `endpoint`.
