---
roles: [roles/account-manager, roles/branch-manager]
reads: [objects/contract, objects/cover, objects/beneficiary, objects/payment]
writes: [objects/rider]
url_pattern: /contracts/:id
---
# Contract overview

Shows a contract with its covers, its beneficiary clause, its balance and its last payments. A rider is entered from this screen; the effective date of each cover is displayed next to it.

## Objects

- Reads: [contract](../objects/contract.md), [cover](../objects/cover.md), [beneficiary](../objects/beneficiary.md), [payment](../objects/payment.md)
- Writes: [rider](../objects/rider.md)

## Actions

1. Record a payment → [free payment entry](free-payment-entry.md)
2. Terminate → [termination request](termination-request.md)
3. Back → [member file](member-file.md)

## Rules

- [Beneficiary designation](../rules/beneficiary-designation.rule.md)
- [Contract renewal notice](../rules/contract-renewal-notice.rule.md)
