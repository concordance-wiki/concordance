---
roles: [roles/account-manager]
reads: [objects/member, objects/contract]
writes: [objects/member]
url_pattern: /members/:id
---
# Member file

Shows the member, the household and the list of contracts. The account manager updates the postal address and the household here; everything about a contract is done from the contract overview.

## Objects

- Reads: [member](../objects/member.md), [contract](../objects/contract.md)
- Writes: [member](../objects/member.md)

## Actions

1. Open contract → [contract overview](contract-overview.md)
2. Record a payment → [free payment entry](free-payment-entry.md)
3. Declare a claim → [claim declaration entry](claim-declaration-entry.md)

## Rules

- [Member age limit](../rules/member-age-limit.rule.md)
