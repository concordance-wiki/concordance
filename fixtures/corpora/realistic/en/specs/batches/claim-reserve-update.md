---
schedule: "0 4 * * 1-5"
window: 04:00-04:30
depends_on: [batches/nightly-settlement]
---
# Claim reserve update

Recomputes the reserve of every claim file under review from the assessor's estimate and the deductible. Runs on working days after the [nightly settlement](nightly-settlement.md).

## Reads

- [Claim](../objects/claim.md)

## Writes

- [CLAIM table](../tables/claim.table.md)
