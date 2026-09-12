---
roles: [roles/account-manager, roles/claims-handler]
reads: [objects/contract, objects/cover]
writes: [objects/claim]
url_pattern: /contracts/:id/claims/new
---
# Claim declaration entry

Records a claim declaration received at the branch: the date of the event, the cover concerned and a description. The [Claims API](../api/claims.md) opens the claim file and checks the [claim deadline](../rules/claim-deadline.rule.md).

## Objects

- Reads: [contract](../objects/contract.md), [cover](../objects/cover.md)
- Writes: [claim](../objects/claim.md)

## Actions

1. Submit → [claim review](claim-review.md)
2. Cancel → [member file](member-file.md)

## Rules

- [Claim deadline](../rules/claim-deadline.rule.md)
