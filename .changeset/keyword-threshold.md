---
"@concordance-wiki/nlp": minor
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
---

Keyword page publication threshold: `publishKeywords` splits the discovered candidates into the pages to generate under `keywords/<slug>` and the expressions discarded by `inference.keyword_pages` (`keywordPublicationOptions`, three occurrences in two distinct files by default), which stay in the output for the search index without a page; `keywordEntities` turns each page into a `term` entity marked `keyword: true` located on its first mention; the build summary gains the optional `keywords` counts, which the build prints as `keyword pages` and `expressions under the threshold`.
