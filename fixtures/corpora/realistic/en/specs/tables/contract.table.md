---
business_object: objects/contract
fields: [CONTRACT_ID, MEMBER_ID, EFFECTIVE_DATE, EXPIRY_DATE, STATUS, BALANCE]
---
# CONTRACT table

One row per contract with its status and its balance. The balance is recomputed by the [nightly settlement](../batches/nightly-settlement.md).
