# @concordance-wiki/nlp

## 0.1.0

### Minor Changes

- b6db21f: Richer default stopwords: the French pack grows from 271 to 993 entries and the English one from 241 to 524, with every form of the auxiliaries and light verbs, the adverbs and connectors of prose, quantifiers, numerals, ordinals and time words, the pieces of contractions and elisions, and the few nouns that only count or place; a word that could be a business term on its own, or that ends a technical compound, stays out. Keyword pages made of those words disappear from the builds.
- 35aff55: Zones excluded from recognition: `scannableText` reduces a parsed markdown document to the text units a scan may read (headings, paragraphs, list items, table cells and quoted paragraphs, each with its line and enclosing section), leaving out fenced and indented code blocks, inline code, URLs, raw HTML, frontmatter, images and link targets while keeping the visible text of links, and the occurrence scan is verified to yield no occurrence for a term present only in a code block.
- 1bbfecc: The context of an occurrence and of a discovered expression quotes the unit as written, the inline code the scan skips put back in place, so that an excerpt never shows a hole where a code span stood; the keyword page groups the passages by page, two excerpts in view per page and the rest behind a fold, six pages in view and the other files behind a disclosure, as the reference design lays them out.
- b9e4031: Word confidence: every keyword candidate carries a confidence in [0, 1], the product of five signals read from the shape of its distribution in the same pass as the score (spread across the files, occurrences per file, prominence in headings, written links and frontmatter, the company of a defined term, the inflected-form suffixes of the language pack's new optional `suffixes.txt`), with its measures as `signals` and the lowering signals as `penalties`; `inference.keyword_pages.min_confidence` (0.5 by default, validated in [0, 1]) joins `min_occurrences` and `min_files`: an expression under it gets no page nor mark in the text, stays searchable and is recorded as `withheld` in `model.json`; the build summary prints `expressions set aside by confidence`, and every keyword page carries its confidence among its attributes. The to-do page lists the words a hundred at a time, the others behind a "Show the N others" disclosure served in the HTML, and folds a third section, "Suspected noise", listing the withheld expressions best score first with their counts and their reason worded in the language of the site ("in 68% of the files, 1.2 per file, verb or adverb form"), none linked, with a call to add them to the project's stopwords leading to `project.contribute_url`.
- d5dc4b0: Keyword page on the shell of the entity page: a banner saying that no note exists with the number of passages and a lead to create the note on the forge of the glossary, the three counts, the passages grouped by file in corpus order with the expression marked, the accompanying words from the co-occurrence of the expression sized by rank, the expressions of a similar form offered as a lead, and a forwarding page that keeps the address of a keyword once a note defines it.
- 34c5a53: Keyword page publication threshold: `publishKeywords` splits the discovered candidates into the pages to generate under `keywords/<slug>` and the expressions discarded by `inference.keyword_pages` (`keywordPublicationOptions`, three occurrences in two distinct files by default), which stay in the output for the search index without a page; `keywordEntities` turns each page into a `term` entity marked `keyword: true` located on its first mention; the build summary gains the optional `keywords` counts, which the build prints as `keyword pages` and `expressions under the threshold`.
- 8ca9305: Language packs are data: a `pack.yaml` validated by the published `language-pack.schema.json` plus a stopword list, loaded the same way for the shipped `en` and `fr` packs and for packs shipped by plugins. Locales are BCP 47 tags resolved to their language; the platform provides word segmentation and collation.
- 77c55e5: Language packs per locale: `languagePack` returns the `en` or `fr` pack (normalisation, default stopwords read from `locales/<locale>/stopwords.txt`, type prefixes of the default profile, accent-insensitive numeric collation), `resolveLocale` applies the source, project, `en` fallback chain, `registerLanguagePack` and `availableLocales` let plugins add locales, and `loadStopwords` parses a stopword file. The locale ingestion records on every source is what the entities will carry.
- 5f8e108: Mentions panel in two sections, written links and recognised mentions, grouped by citing file in collapsible groups; the first `build.mentions_inline` mentions in the served HTML, the rest in one `fragments/<id>.mentions.json` per entity, embedded in the page under two hundred mentions and fetched on demand beyond; the island adds sorting, filtering and a collapse-all; occurrences and mention provenances carry the matched text and its passage.
- c290f2b: Occurrence scan: `tokenize` cuts a text into words in comparison form with their character spans; `buildAutomaton`, `scan` and `longestMatches` run a word-level Aho-Corasick automaton in one pass per text and keep the longest expression on overlap; `scanDocument` builds the automaton once per dictionary and emits, for every mention in the paragraphs of a document, one occurrence per target with file, line, position, section, an 80-character centred context, the type announced by a recognised prefix (`type_prefixes`, plus the `type_prefix_bonus`) and a confidence halved for homonyms; `occurrenceConfidence` gives the per-occurrence increments up to the cap and `compareOccurrences` the canonical order.
- 7bbb659: Recognition dictionary: `buildDictionary` keys every title and alias of the entities of a locale by comparison form, orders the targets of a form with glossary sources first, leaves out stopwords and terms shorter than three characters unless `inference.short_terms` allows them, and flags a form shared by several entities as a homonym with an `I-TERM-HOMONYM` finding; `dictionaryStopwords` merges the pack's default stopwords with the files listed under `inference.stopwords`, and `glossarySources` names the priority sources from `inference.glossary_sources` or the `glossary: true` marks.
- 22ee8ab: Recurring unreferenced expressions: `extractNgrams` yields the n-grams of one to four words of the text units of notes and documents, minus those starting or ending with a stopword, made only of digits or shorter than three characters, each with its surface form, position and context; `scoreCandidates` groups them by comparison form, leaves out the dictionary entries and the lock's `rejected_terms`, scores each candidate by C-value × IDF (an n-gram nested in a longer, more frequent one is penalised) and keeps those with three occurrences in two distinct files; `undefinedTermFindings` reports the candidates at or above `inference.candidate_score` as `W-TERM-UNDEFINED`, and `keywordOptions` reads every threshold from the configuration and the lock.
- cc77d53: Create the packages with their entry points and the build toolchain.
- 23617d8: Search index generated at build: `buildSearchIndex` tokenises the title, aliases, summary, body (cut at `build.extracted_text_max_chars`), type, application, domain, status and source of every entity with `searchTokens` of the language packs, and `searchIndexFiles` writes it under `search/` as classic scripts, one shard per two-character prefix and an entity table, so that the `search` island loads them in pieces as the reader types from a `file://` page as well as behind a server; the header field of every page suggests the best results, `/` reaches it and `Escape` leaves it, and `search/index.html` lists the results of the query in its address; the fragments carry the plain text of the note, `SearchResult` gains a `breadcrumb`, islands can be bundled as classic scripts, and the build summary reports the weight of the index and its number of shards.
- af5cdd2: Text normalisation: `comparisonForm` and `comparisonWords` give the form two spellings are compared on (lower-cased, accents stripped, apostrophes unified, each word singularised by the pack's plural rules, hyphens and apostrophes kept inside words), `singularize` applies the first matching suffix rule, and `wordBoundaries` and `isOnWordBoundaries` expose the word positions of a text so that a match is only accepted on word boundaries. The `fr` pack orders `-eaux` before `-aux`, replaces the bare `-x` rule by `-oux` so that invariant words such as "prix" stay as they are, and lowers the `-eux` minimum length so that "jeux" gives "jeu"; both packs stop the `-s` rule on words in `-ss`, so that "address" is stable.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- 3fca4dd: Occurrence scan: a match that starts inside a longer match and ends after it is kept when it names another entry ("build log" and "log summary" in "the build log summary" both count); only an expression contained in a longer recognised expression is dropped, so "keyword page" still beats "page".
- Updated dependencies [203133d]
- Updated dependencies [378a546]
- Updated dependencies [d910b38]
- Updated dependencies [79c8264]
- Updated dependencies [ce3bc7c]
- Updated dependencies [0591795]
- Updated dependencies [24a33f7]
- Updated dependencies [f900830]
- Updated dependencies [2d7b65d]
- Updated dependencies [af10923]
- Updated dependencies [b5f0071]
- Updated dependencies [116aca4]
- Updated dependencies [050d8a7]
- Updated dependencies [b17e66c]
- Updated dependencies [69cf231]
- Updated dependencies [ee71a72]
- Updated dependencies [e20e743]
- Updated dependencies [4154f49]
- Updated dependencies [a1c0353]
- Updated dependencies [b9e4031]
- Updated dependencies [34c5a53]
- Updated dependencies [4bd6bd7]
- Updated dependencies [b092a63]
- Updated dependencies [8ca9305]
- Updated dependencies [3fb3d96]
- Updated dependencies [cfc0835]
- Updated dependencies [efb8c03]
- Updated dependencies [07c9269]
- Updated dependencies [2fe703f]
- Updated dependencies [f34c511]
- Updated dependencies [38a63c6]
- Updated dependencies [de7f8a2]
- Updated dependencies [64664a4]
- Updated dependencies [d0c0bc5]
- Updated dependencies [ef6d6fe]
- Updated dependencies [66d7b33]
- Updated dependencies [ce3f837]
- Updated dependencies [676a36a]
- Updated dependencies [c995c47]
- Updated dependencies [a5ef5ff]
- Updated dependencies [84a3d54]
- Updated dependencies [2922261]
- Updated dependencies [cc77d53]
- Updated dependencies [c5048be]
- Updated dependencies [a814a6e]
- Updated dependencies [cc3beed]
- Updated dependencies [a954edf]
- Updated dependencies [0ef98c5]
- Updated dependencies [14088cd]
- Updated dependencies [c623d60]
- Updated dependencies [1a5f84d]
- Updated dependencies [c1a3598]
- Updated dependencies [c54d224]
- Updated dependencies [223a319]
  - @concordance-wiki/core@0.1.0
