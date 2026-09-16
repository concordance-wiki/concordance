---
"@concordance-wiki/core": patch
"@concordance-wiki/checks": patch
"@concordance-wiki/lint": patch
---

The findings, the check registry and the relation attributes of the global lint are ordered code unit by code unit rather than by the collation of the runtime, so that two machines write the same order.
