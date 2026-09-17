---
"@concordance-wiki/core": patch
"@concordance-wiki/site": patch
---

A schema error under a key carrying a slash, as every identifier of a model does, is described with its path and its value instead of failing; a `$` in an alias, a search query, a pinned title or a mention count is written as it is in the labels of the site; the edit links to the forge encode every segment of the path, so that `#`, `?`, `%` and spaces reach it.
