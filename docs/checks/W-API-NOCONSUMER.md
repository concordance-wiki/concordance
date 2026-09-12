# W-API-NOCONSUMER

**Severity:** warning. **Family:** contracts.

An API has no consumer, declared or inferred.

Nothing links a screen, a process or a batch to this API: neither a `consumers` attribute, nor a `## Consumers` section, nor a mention in another note.

## Before

```
---
protocol: rest
---
# Model query API
```

## After

```
---
protocol: rest
consumers: [screens/search-results]
---
# Model query API
```

## How to fix

Declare the consumers, or mention the API in the notes that use it.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
