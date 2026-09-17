# W-CONTRACT-UNREACHABLE

**Severity:** warning. **Family:** contracts.

The contract an API note declares could not be fetched, read or parsed, so no operation was imported from it and the note keeps the operations written by hand.

An `api` note names its contract in the `contract` attribute, as a URL or as a path relative to the note. A path that leaves the source (absolute, or climbing above its root) is refused; a URL that points at the build machine, its link-local neighbours or a private network is never fetched; a host name is fetched as written. The `contract-openapi` and `contract-wsdl` plugins fetch or read it, check that it is an OpenAPI 3.x document or a WSDL 1.1 or 2.0 document, and produce one `endpoint` entity per operation. When the URL answers with an error, the build runs without network access, the file is missing, or the document is not valid JSON or YAML, declares another OpenAPI version than 3.x, is not well-formed XML or is an XML document whose root is neither `definitions` nor `description`, the plugin reports this finding with the reason and the build goes on: the API page has no imported operations until the next build reads the contract. A well-formed XML document that is not a WSDL is left to no plugin: nothing is imported and nothing is reported for it.

## Before

```
---
type: api
contract: https://example.invalid/model-query/openapi.json   (the server answers 404)
---
# Model query API
```

```
warning: W-CONTRACT-UNREACHABLE (specs:api/model-query.md): contract https://example.invalid/model-query/openapi.json of specs/api/model-query could not be read: HTTP 404
```

## After

```
---
type: api
contract: ./model-query.openapi.json
---
# Model query API
```

## How to fix

Fix the URL or the path, give the build network access when the contract is fetched, or check that the file is an OpenAPI 3.x document in JSON or YAML, or a WSDL document whose plugin is enabled. Raise the severity to `error` under `checks:` when a missing contract must fail the build.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
