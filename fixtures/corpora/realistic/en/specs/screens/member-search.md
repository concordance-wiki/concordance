---
roles: [roles/account-manager, roles/claims-handler]
reads: [objects/member, objects/contract]
url_pattern: /members
---
# Member search

Finds a member by name, member number or contract number. Entry point of every back-office journey: a payment, a claim declaration or a termination starts here.

## Objects

- Reads: [member](../objects/member.md), [contract](../objects/contract.md)

## Actions

1. Open → [member file](member-file.md)
2. New contract → [contract overview](contract-overview.md)
