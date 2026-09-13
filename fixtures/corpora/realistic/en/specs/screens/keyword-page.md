---
roles: [roles/maintainer]
reads: [objects/keyword-page, objects/occurrence]
writes: [objects/candidate]
url_pattern: /keywords/:slug
---
# Keyword page

Lets a maintainer review a keyword page: the passages of an expression that crosses the [publication threshold](../rules/publication-threshold.rule.md) without any note defining it. The counts come from the [Canonical model API](../api/canonical-model.md); the page displays them and never recounts an occurrence.

Expressions rejected in the lock file are not shown here: they are dropped before the model is written.

## Objects

- Reads: [keyword page](../objects/keyword-page.md), [occurrence](../objects/occurrence.md)
- Writes: [candidate](../objects/candidate.md)

## Actions

1. Open an entity → [entity page](entity-page.md)
2. Search → [search results](search-results.md)

## Rules

- [Publication threshold](../rules/publication-threshold.rule.md)
- [Keyword page identifier](../rules/keyword-page-identifier.rule.md)
- [Rejected terms never proposed](../rules/rejected-terms-never-proposed.rule.md)
