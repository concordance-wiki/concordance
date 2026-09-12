---
roles: [roles/account-manager]
reads: [objects/payment, objects/contract]
url_pattern: /contracts/:id/payments/:paymentId
---
# Payment summary

Shows the payment just entered with its value date. The balance of the contract is only updated after the [nightly settlement](../batches/nightly-settlement.md), which the screen states explicitly.

## Objects

- Reads: [payment](../objects/payment.md), [contract](../objects/contract.md)

## Actions

1. Back to contract → [contract overview](contract-overview.md)
