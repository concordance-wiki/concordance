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

## Checks applied

| Rule | Severity | Effect on validation |
|---|---|---|
| [Identifier pattern](../rules/identifier-pattern.rule.md) | blocking | The build stops and the finding names the file |
| [Stale after 180 days](../rules/stale-after-180-days.rule.md) | warning | A badge on the page and a line in the staleness report |
| [Related relation cap](../rules/related-relation-cap.rule.md) | warning | The confidence shown never exceeds 0.6 |

## Original sketch

![Sketch of the entity page: the tree of the space, the note, the panel](../assets/entity-page-sketch.svg)
