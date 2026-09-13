# W-OPERATION-AMBIGUOUS

**Severity:** warning. **Family:** contracts.

Two operation notes claim the same operation imported from a contract, or one operation note matches several operations of its API, so no note was attached to the operation.

An `endpoint` note written by hand attaches to an operation of the contract its API declares when its frontmatter `operation_id` equals the operation's, else when its `method` and `path` (or its `port` and its title, for a SOAP operation) equal the operation's, else when its title in comparison form equals the operation title or its identifier. The note names its API in the `api` attribute or through a markdown link; a note that names none is a candidate for every API of its source that has a contract. At the rung where a match is found, a note that matches several operations, or an operation that several notes claim, is ambiguous: the build reports this finding naming every candidate, attaches nothing, and the imported operation stays a separate entity with the properties of the contract only. The other notes and operations of the API are matched as usual.

## Before

```
---
type: endpoint
api: api/model-query
operation_id: listEntities
---
# List the entities
```

```
---
type: endpoint
api: api/model-query
operation_id: listEntities
---
# Entities of the last build
```

```
warning: W-OPERATION-AMBIGUOUS (specs:api/contracts/model-query.openapi.json): operation specs/api/model-query/listentities of specs/api/model-query is claimed by 2 notes on the operation identifier: specs/endpoints/entities-of-the-last-build, specs/endpoints/list-entities; none is attached
```

## After

```
---
type: endpoint
api: api/model-query
operation_id: listEntities
---
# List the entities
```

```
---
type: endpoint
api: api/model-query
operation_id: getEntity
---
# Entities of the last build
```

## How to fix

Give each operation note the `operation_id` of exactly one operation of its API, or remove the note that duplicates another. When a note matches several operations because the source declares several contracts and the note names none, set its `api` attribute to the API it describes. When two operations of one API share a method and path or a title, declare the `operation_id` in the note so that the first rung decides.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
