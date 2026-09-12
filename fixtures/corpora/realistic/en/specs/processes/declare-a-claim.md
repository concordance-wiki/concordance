---
execution: mixed
triggers: [claim reported by the member]
---
# Declare a claim

A member reports an event covered by the contract.

## Steps

1. The [account manager](../roles/account-manager.md) records the declaration on [claim declaration entry](../screens/claim-declaration-entry.md).
   - If the [claim deadline](../rules/claim-deadline.rule.md) is passed, the declaration is refused unless the [branch manager](../roles/branch-manager.md) waives it.
2. The [Claims API](../api/claims.md) opens the claim file.
3. The [claims handler](../roles/claims-handler.md) reviews the file on [claim review](../screens/claim-review.md) and mandates an assessor.
4. The indemnity is approved and paid as a payment on the contract.
5. End.
