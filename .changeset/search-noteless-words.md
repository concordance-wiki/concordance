---
"@concordance-wiki/site": minor
"@concordance-wiki/i18n": minor
---

Noteless words among the search results: a keyword page travels in the entity table with its flag, its occurrences and its documents, is drawn as a row outlined in dots stating that no note defines the expression and its counts, worded in the site language, on the results page and under the header field alike; a fifth facet, "Without a note", keeps the keyword pages among the results, keeps them alone or leaves them out (`nonote=only|exclude` in the address), and the ranking never puts a keyword page before an entity of the same score. `SearchResult` gains `keyword`, `subtitle` and `detail`, `rank` takes a `keyword` predicate for its tie-break, and the catalogues gain `search.facet.noNote` and `search.noNote.any`, `only` and `exclude`.
