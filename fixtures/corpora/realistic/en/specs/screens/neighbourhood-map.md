---
roles: [roles/author, roles/maintainer]
reads: [objects/neighbourhood, objects/link]
url_pattern: /entities/:id/map
---
# Neighbourhood map

Draws the neighbourhood of an entity: the strongest links first, in the order the profile gives for the type, the related links last and capped. An island: it reads the model and writes nothing.

## Objects

- Reads: [neighbourhood](../objects/neighbourhood.md), [link](../objects/link.md)

## Actions

1. Open an entity → [entity page](entity-page.md)

## Rules

- [Related relation cap](../rules/related-relation-cap.rule.md)
