---
method: GET
path: /model.json
api: api/canonical-model
operation_id: readModel
---
# Read the model

Returns the whole canonical model as the build wrote it. The only operation of the file API: no filter, no pagination, the bytes of the last build.

## Consumers

- [Home page](../screens/home-page.md)
- [Entity page](../screens/entity-page.md)
