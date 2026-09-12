---
application: policy-admin
date: 2026-06-10
---
# Claims eligibility study

Sizes the check of the waiting period at declaration. Today the waiting period is read from the policy schedule by the claims handler; tomorrow the [Claims API](../specs/api/claims.md) reads it from the cover and refuses a claim declared inside the waiting period.

The change touches [claim declaration entry](../specs/screens/claim-declaration-entry.md), the [claim deadline](../specs/rules/claim-deadline.rule.md) rule and the portal's [claim tracking](../specs/screens/portal/claim-tracking.md).
