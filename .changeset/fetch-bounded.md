---
"@concordance-wiki/core": minor
"@concordance-wiki/lint": patch
---

A contract fetched by URL and the published model of the global lint scope are read within thirty seconds and fifty megabytes (`fetchWithin`, `readBounded` and `fetchFailure` in the core package): a server that never answers or a response that never ends is reported instead of holding the build, the hook or the pipeline for ever, the linter falling back on its cached copy.
