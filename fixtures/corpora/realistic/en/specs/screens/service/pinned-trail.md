---
roles: []
reads: [objects/entity, objects/link]
url_pattern: /service/trail
---
# Pinned trail

Keeps the entities a reader pinned from page to page, as decided in [pinned trail in service](../../../decisions/pinned-trail-in-service.md). The [Model query API](../../api/model-query.md) serves them with the same confidence cap as the static site.

## Objects

- Reads: [entity](../../objects/entity.md), [link](../../objects/link.md)

## Actions

1. Open the document → [document viewer](document-viewer.md)

## Rules

- [Related relation cap](../../rules/related-relation-cap.rule.md)
- [Identifier pattern](../../rules/identifier-pattern.rule.md)
