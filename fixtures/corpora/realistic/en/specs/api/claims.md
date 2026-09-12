---
protocol: soap
exposure: internal
version: "1"
contract: contracts/claims.wsdl
consumers: [screens/claim-review]
---
# Claims API

Opens claim files and reports their status. A legacy SOAP service described by its [contract](contracts/claims.wsdl); the claim review screen is declared as a consumer although it works on the claim file directly, which the consumer mismatch check reports.

## Consumers

- [Claim declaration entry](../screens/claim-declaration-entry.md)
- [Claim tracking](../screens/portal/claim-tracking.md)
- [Declare a claim](../processes/declare-a-claim.md)

## Objects

- [Claim](../objects/claim.md)
- [Indemnity](../objects/indemnity.md)
