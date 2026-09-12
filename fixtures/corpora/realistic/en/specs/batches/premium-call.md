---
schedule: "0 5 1 * *"
window: 05:00-06:00
depends_on: [batches/nightly-settlement]
---
# Premium call

Calls the premiums due for the month, sends the renewal notices and hands the direct debits to the bank. Runs after the [nightly settlement](nightly-settlement.md).

## Reads

- [Premium](../objects/premium.md)
- [CONTRACT table](../tables/contract.table.md)

## Writes

- [Premium](../objects/premium.md)
