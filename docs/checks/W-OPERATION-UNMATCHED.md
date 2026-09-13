# W-OPERATION-UNMATCHED

**Severity:** warning. **Family:** contracts.

An operation note names an API whose contract was imported, and none of the operations of that contract matches the note: either the operation disappeared from the contract, or the note describes an operation the contract does not declare yet.

An `endpoint` note written by hand attaches to an operation of the contract its API declares on its frontmatter `operation_id`, then on its `method` and `path` (or its `port` and its title, for a SOAP operation), then on its title in comparison form. The note names its API in the `api` attribute or through a markdown link. When that API has an imported contract and no rung matches, the build reports this finding on the note: the note keeps its own page with the properties it declares, the contract section of the API page does not list it, and the other notes of the API are matched as usual. A note that names no API is a candidate for every contract of its source and is not reported: it may describe an API without a contract. A note taken in an ambiguity is reported by [`W-OPERATION-AMBIGUOUS`](W-OPERATION-AMBIGUOUS.md) instead.

## Before

```
---
type: endpoint
api: api/model-query
operation_id: deleteEntity
---
# Delete an entity
```

```
warning: W-OPERATION-UNMATCHED (specs:endpoints/delete-entity.md:1): operation note specs/endpoints/delete-entity matches no operation of specs/api/model-query (contracts/model-query.openapi.json): the operation disappeared from the contract, or the note is ahead of it
```

## After

Either the operation is gone from the contract, and the note goes with it or points at its replacement:

```
---
type: endpoint
api: api/model-query
operation_id: getEntity
---
# Read an entity
```

Or the note is ahead of the contract: it stays as it is, with the `operation_id` the next version of the contract will declare, and the finding disappears when the contract catches up.

## How to fix

Compare the note with the contract the API note declares. When the operation was removed, retire the note or set its `operation_id`, `method` and `path` to the operation that replaced it. When the note describes an operation to come, keep it: the finding measures the gap between the notes and the contract, in both directions, and closes on its own once the contract declares the operation. The [contract section](../guides/theming.md#the-contract-viewer) of the API page shows the other direction of the gap, the operations of the contract that have no note yet.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
