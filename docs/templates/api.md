---
type: api
protocol: rest
exposure: apim
version: "2"
contract: ./openapi.example.json
---
# Payments API

Records and reads [payments](business_object.md) on a contract. Since the [cap checked server-side](decision.md) decision it is the only place that checks the [annual cap](rule.md).

## Consumers

- [Free payment entry](screen.md)

## Objects

- [Payment](business_object.md)
