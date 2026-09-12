---
roles: [roles/account-manager, roles/branch-manager]
reads: [objects/contract]
writes: [objects/contract, objects/refund]
url_pattern: /contracts/:id/terminate
---
# Termination request

Records a termination requested by the member. The notice is computed by the [termination notice](../rules/termination-notice.rule.md) rule; when the request falls inside the cooling-off period, a refund is created under the [withdrawal refund](../rules/withdrawal-refund.rule.md) rule.

## Objects

- Reads: [contract](../objects/contract.md)
- Writes: [contract](../objects/contract.md), [refund](../objects/refund.md)

## Actions

1. Confirm → [contract overview](contract-overview.md)
2. Cancel → [contract overview](contract-overview.md)

## Rules

- [Termination notice](../rules/termination-notice.rule.md)
- [Withdrawal refund](../rules/withdrawal-refund.rule.md)
