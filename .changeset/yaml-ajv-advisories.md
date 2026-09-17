---
"@concordance-wiki/core": patch
"@concordance-wiki/cli": patch
"@concordance-wiki/inference": patch
"@concordance-wiki/ingest": patch
"@concordance-wiki/lint": patch
"@concordance-wiki/nlp": patch
"@concordance-wiki/profile": patch
"@concordance-wiki/site": patch
"@concordance-wiki/typing": patch
---

`yaml` is pinned to 2.8.3 and `ajv` to 8.18.0, the versions that close the two moderate advisories `pnpm audit` reported (a stack overflow on a nested sequence of a few kilobytes, which the frontmatter of any note could carry; a ReDoS on `$data` references, unused here).
