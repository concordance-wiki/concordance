---
"@concordance-wiki/core": patch
"@concordance-wiki/ingest": patch
---

The file system skips `node_modules` folders as it skips `.git`, and a URL written between brackets, which the parser leaves without a position, takes the line of its paragraph instead of stopping the build or the lint.
