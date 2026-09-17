---
"@concordance-wiki/core": patch
"@concordance-wiki/nlp": patch
"@concordance-wiki/ingest": patch
"@concordance-wiki/cli": patch
---

Two keywords sharing a slug take their addresses in code-unit order of the keys, never by score, so that the address of a keyword page depends on the published keys alone; a local source holding the cache or the output folder (`path: .`) never reads back what the build wrote; a stopword file the configuration names but does not exist is an error `validate-config` and `build` report before anything starts, instead of an exception of the pipeline.
