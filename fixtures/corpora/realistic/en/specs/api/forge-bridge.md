---
application: concordance-service
protocol: soap
exposure: internal
version: "0"
contract: contracts/forge-bridge.wsdl
---
# Forge bridge API

A bridge towards the forges that only speak SOAP: the forge notifies a build and fetches its findings, as described by the [contract](contracts/forge-bridge.wsdl). Nothing consumes it yet, as recorded in [forge bridge exposed](../../decisions/forge-bridge-exposed.md).

## Objects

- [Build](../objects/build.md)
- [Finding](../objects/finding.md)
