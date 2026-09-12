---
protocol: rest
exposure: apim
version: "2"
contract: contracts/payments.openapi.json
---
# Payments API

Records and reads payments on a contract. The only place that checks the [annual cap](../rules/annual-cap.rule.md) and the [monthly cap](../rules/monthly-cap.rule.md), as decided in [cap checked server-side](../../decisions/cap-checked-server-side.md). The [contract](contracts/payments.openapi.json) lists three operations.

## Consumers

- [Free payment entry](../screens/free-payment-entry.md)
- [Online payment](../screens/portal/online-payment.md)
- [Nightly settlement](../batches/nightly-settlement.md)
- [Record a payment](../processes/record-a-payment.md)

## Objects

- [Payment](../objects/payment.md)
- [Premium](../objects/premium.md)
