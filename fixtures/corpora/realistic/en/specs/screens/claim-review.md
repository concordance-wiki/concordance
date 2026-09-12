---
roles: [roles/claims-handler]
reads: [objects/claim, objects/cover, objects/contract]
writes: [objects/claim, objects/indemnity]
url_pattern: /claims/:id
---
# Claim review

Where the claims handler reviews a claim file: the assessor's report is attached, the deductible is applied and the indemnity is proposed. The reserve shown comes from the [claim reserve update](../batches/claim-reserve-update.md) batch.

## Objects

- Reads: [claim](../objects/claim.md), [cover](../objects/cover.md), [contract](../objects/contract.md)
- Writes: [claim](../objects/claim.md), [indemnity](../objects/indemnity.md)

## Actions

1. Close with indemnity → [payment summary](payment-summary.md)
2. Back → [member search](member-search.md)

## Rules

- [Deductible applied](../rules/deductible-applied.rule.md)
