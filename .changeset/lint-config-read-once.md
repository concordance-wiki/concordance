---
"@concordance-wiki/lint": patch
"@concordance-wiki/cli": patch
---

`concordance lint` reads and validates `concordance-lint.yaml` once per run and shares it with the fixes, the local checks and the global scope, instead of reading it in each; `lintRepository` and `fixRepository` accept the overrides already read.
