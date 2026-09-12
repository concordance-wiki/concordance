---
method: POST
path: /payments
api: api/payments
operation_id: createPayment
---
# Create a payment

Checks the caps before creating the [payment](../objects/payment.md). Refuses with a 409 and the reason, which the screen displays as-is.

## Consumers

- [Free payment entry](../screens/free-payment-entry.md)
- [Online payment](../screens/portal/online-payment.md)

## Rules

- [Annual cap](../rules/annual-cap.rule.md)
- [Monthly cap](../rules/monthly-cap.rule.md)
