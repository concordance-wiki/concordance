---
roles: []
reads: [objects/contract]
writes: [objects/payment]
url_pattern: /portal/contracts/:id/pay
---
# Online payment

Lets the member make a free payment from the portal, as decided in [online payment in portal](../../../decisions/online-payment-in-portal.md). The [Payments API](../../api/payments.md) applies the same caps as the branch screen.

## Objects

- Reads: [contract](../../objects/contract.md)
- Writes: [payment](../../objects/payment.md)

## Actions

1. Confirm → [my contracts](my-contracts.md)

## Rules

- [Annual cap](../../rules/annual-cap.rule.md)
- [Monthly cap](../../rules/monthly-cap.rule.md)
