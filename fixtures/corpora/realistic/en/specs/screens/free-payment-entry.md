---
roles: [roles/account-manager]
reads: [objects/contract, objects/member]
writes: [objects/payment]
url_pattern: /contracts/:id/pay
---
# Free payment entry

Lets an account manager record a free payment on a running contract at the member's request. The amount is checked against the [annual cap](../rules/annual-cap.rule.md) and the [monthly cap](../rules/monthly-cap.rule.md) by the [Payments API](../api/payments.md); the screen displays the returned message and never recomputes a cap.

Exceptional payments are not entered here: they are handled manually in the branch.

## Objects

- Reads: [contract](../objects/contract.md), [member](../objects/member.md)
- Writes: [payment](../objects/payment.md)

## Actions

1. Validate → [payment summary](payment-summary.md)
2. Cancel → [member search](member-search.md)

## Rules

- [Annual cap](../rules/annual-cap.rule.md)
- [Monthly cap](../rules/monthly-cap.rule.md)
- [Direct debit mandate required](../rules/direct-debit-mandate-required.rule.md)
