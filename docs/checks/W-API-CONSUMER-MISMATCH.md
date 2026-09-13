# W-API-CONSUMER-MISMATCH

**Severity:** warning. **Family:** contracts.

An API declares a consumer that never cites it, or a note cites an API that does not list it.

The two sides disagree. One of them is out of date. A consumer is declared under `consumers`, as an identifier written in full or relative to the source of the API note, or listed under the `## Consumers` section of the API note; it cites the API when a `serves` link between the two was read in its own note (a written link, a prose mention, a mention under a mapped section), the API's own `consumers` attribute and `## Consumers` section counting as declarations, not citations. The `consumers` attribute asks for the reconciliation: an API note without it is left to `W-API-NOCONSUMER`.

## Before

```
api/model-query.md declares consumers: [screens/alphabetical-index]
screens/alphabetical-index.md never mentions the Model query API
```

## After

```
api/model-query.md declares consumers: [screens/search-results]
screens/search-results.md: "calls the [Model query API](../api/model-query.md)"
```

## How to fix

Reconcile the two notes: remove the stale consumer or add the missing mention.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
