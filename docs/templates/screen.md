---
type: screen
roles: [role]
url_pattern: /contract/:id/pay
status: valid
---
# Free payment entry

Lets an [account manager](role.md) record a [free payment](term.md) on a running contract at the member's request. Reachable from the member page and from search.

## Entry

The account manager enters an amount and a value date. On validation the amount is checked against the [annual cap](rule.md); when it is exceeded the screen shows the message returned by the [Payments API](api.md).

## Objects

- Reads: [payment](business_object.md)
- Writes: [payment](business_object.md)

## Actions

1. Validate → payment summary
2. Cancel → member search

## Rules

- [Annual cap](rule.md)
