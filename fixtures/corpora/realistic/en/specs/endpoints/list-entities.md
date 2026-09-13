---
method: GET
path: /entities
api: api/model-query
operation_id: listEntities
---
# List the entities

Returns the [entities](../objects/entity.md) of the last build, filtered by type, application or domain, in identifier order. The confidence cap applies to the links embedded in the answer.

## Consumers

- [Pinned trail](../screens/service/pinned-trail.md)
- [Document viewer](../screens/service/document-viewer.md)

## Rules

- [Identifier pattern](../rules/identifier-pattern.rule.md)
