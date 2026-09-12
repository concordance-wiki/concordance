---
type: endpoint
method: POST
path: /payments
api: api
operation_id: createPayment
---
# Create a payment

Checks the [annual cap](rule.md) before creating the [payment](business_object.md). Refuses with a 409 and the reason, which the screen displays as-is.

## Consumers

- [Free payment entry](screen.md)

## Rules

- [Annual cap](rule.md)
