---
"@concordance-wiki/lint": patch
---

The SARIF log no longer carries `originalUriBaseIds`: the base URI named the folder of the machine that ran the lint, so two checkouts of the same tree gave different logs. Artifact locations keep their `uriBaseId` of `%SRCROOT%`, which the forges resolve against their checkout.
