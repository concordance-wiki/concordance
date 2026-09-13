---
application: concordance-service
protocol: rest
exposure: apim
version: "0"
contract: contracts/model-query.openapi.json
consumers: [screens/service/suggestion-review]
---
# Model query API

Serves the canonical model of the last build over HTTP, for the service screens and for the tools that cannot read `model.json`. Nothing of it exists in this version. The [contract](contracts/model-query.openapi.json) lists three operations, which the contract import matches to the operation notes; the suggestion review screen is declared as a consumer although it works on the lock file directly, which the consumer mismatch check reports.

## Consumers

- [Document viewer](../screens/service/document-viewer.md)
- [Pinned trail](../screens/service/pinned-trail.md)

## Objects

- [Entity](../objects/entity.md)
- [Link](../objects/link.md)
- [Finding](../objects/finding.md)
