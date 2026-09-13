---
"@concordance-wiki/site": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/nlp": minor
---

Search index generated at build: `buildSearchIndex` tokenises the title, aliases, summary, body (cut at `build.extracted_text_max_chars`), type, application, domain, status and source of every entity with `searchTokens` of the language packs, and `searchIndexFiles` writes it under `search/` as classic scripts, one shard per two-character prefix and an entity table, so that the `search` island loads them in pieces as the reader types from a `file://` page as well as behind a server; the header field of every page suggests the best results, `/` reaches it and `Escape` leaves it, and `search/index.html` lists the results of the query in its address; the fragments carry the plain text of the note, `SearchResult` gains a `breadcrumb`, islands can be bundled as classic scripts, and the build summary reports the weight of the index and its number of shards.
