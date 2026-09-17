---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": patch
"@concordance-wiki/ingest": patch
---

The credentials a URL carries never reach a published file: `model.json` records the git URL of a source without them, and the finding of an unreachable source strips them from what git echoed (`withoutCredentials` in the core package).
