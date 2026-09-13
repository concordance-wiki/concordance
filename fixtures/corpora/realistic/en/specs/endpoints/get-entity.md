---
method: GET
path: /entities/{id}
api: api/model-query
operation_id: getEntity
---
# Read an entity

Returns one [entity](../objects/entity.md) with its links and its representation when it has one. Answers 404 to an identifier the model does not know.

## Consumers

- [Document viewer](../screens/service/document-viewer.md)
