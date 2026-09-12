---
schedule: "0 2 * * *"
window: 02:00-04:00
depends_on: []
---
# Nightly settlement

Settles the payments of the day, pays the refunds, triggers the scheduled payment instalments and recomputes every contract balance. Calls the [Payments API](../api/payments.md) for each instalment.

## Reads

- [Payment](../objects/payment.md)
- [Refund](../objects/refund.md)

## Writes

- [PAYMENT table](../tables/payment.table.md)
- [CONTRACT table](../tables/contract.table.md)
