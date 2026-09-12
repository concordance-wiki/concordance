---
type: batch
schedule: "0 2 * * *"
window: 02:00-04:00
depends_on: []
---
# Nightly settlement

Settles the [payments](business_object.md) entered during the day and updates contract balances. Screens show a balance that is only updated after this batch, which the payment summary states explicitly.

## Reads

- [Payment](business_object.md)

## Writes

- [PAYMENT table](data_object.md)
