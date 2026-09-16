---
"@concordance-wiki/cli": minor
"@concordance-wiki/site": patch
---

`concordance query --search <words>` runs the search of the site from the command line, with the same ranking and facets as the results page, from the index the site wrote, else from the model and its fragments, else from the model alone; `--keywords-only` and `--no-keywords` filter the keyword pages. The search index takes the English labels when nobody gives it any.
