---
"@concordance-wiki/ingest": patch
"@concordance-wiki/nlp": patch
"@concordance-wiki/lint": patch
---

A local source, a stopword file and the locations of the global lint block are resolved as the platform resolves paths: on Windows a `path` source relative to the configuration was reported unreachable.
