---
roles: [roles/account-manager]
url_pattern: /contract/:id/pay
---
# Free payment entry

Lets an account manager record a free payment on a running contract at the member's request. The amount is checked against the [annual cap](../rules/annual-cap.rule.md) by the [Payments API](../api/payments.md); the screen displays the returned message.

Exceptional payments are not entered here: they are handled manually in the branch.

## Objects

- Reads: [contract](../objects/contract.md), [member](../objects/member.md)
- Writes: [payment](../objects/payment.md)

## Actions

1. Validate → [payment summary](payment-summary.md)
2. Cancel → [member search](member-search.md)

## Rules

- [Annual cap](../rules/annual-cap.rule.md)
