---
method: POST
path: /DeclareClaim
api: api/claims
operation_id: DeclareClaim
---
# Declare a claim

Opens a claim file for a [claim](../objects/claim.md) and returns its number. Refuses a declaration received after the deadline.

## Consumers

- [Claim declaration entry](../screens/claim-declaration-entry.md)

## Rules

- [Claim deadline](../rules/claim-deadline.rule.md)
