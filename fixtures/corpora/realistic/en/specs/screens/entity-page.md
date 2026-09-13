---
roles: [roles/author, roles/maintainer]
reads: [objects/entity, objects/link, objects/neighbourhood]
url_pattern: /entities/:id
---
# Entity page

Shows an entity with its attributes, its links grouped by relation, its neighbourhood and the passages that mention it. The staleness badge comes from the [staleness report](../batches/staleness-report.md) batch; the confidence of each link is displayed as the model wrote it.

## Objects

- Reads: [entity](../objects/entity.md), [link](../objects/link.md), [neighbourhood](../objects/neighbourhood.md)

## Actions

1. Open the mentions → [mentions panel](mentions-panel.md)
2. Open the map → [neighbourhood map](neighbourhood-map.md)
3. Back → [search results](search-results.md)

## Rules

- [Identifier pattern](../rules/identifier-pattern.rule.md)
- [Related relation cap](../rules/related-relation-cap.rule.md)
