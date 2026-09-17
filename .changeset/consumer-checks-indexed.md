---
"@concordance-wiki/checks": patch
---

The two consumer checks index the entities and the `serves` links once per run instead of rebuilding a set of every identifier for every declared consumer and walking every link three times per API.
