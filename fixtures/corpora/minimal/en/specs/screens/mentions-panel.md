---
roles: [roles/maintainer]
url_pattern: /entities/:id/mentions
---
# Mentions panel

Lets a maintainer confirm an explicit link on a finished build for a typed entity. The confidence is checked against the [related link cap](../rules/related-link-cap.rule.md) by the [Model query API](../api/model-query.md); the panel displays the returned message.

The build summary is not shown here: it is printed at the end of the nightly build.

## Objects

- Reads: [build](../objects/build.md), [entity](../objects/entity.md)
- Writes: [link](../objects/link.md)

## Actions

1. Confirm → [neighbourhood map](neighbourhood-map.md)
2. Cancel → [entity page](entity-page.md)

## Rules

- [Related link cap](../rules/related-link-cap.rule.md)
