# @concordance-wiki/nlp

## 0.4.0

### Minor Changes

- 524f45d: The alphabetical index, the category lists and the dated spaces are ordered by a collation computed from the options of the language pack (`collation` in the core package: accents and case set aside, digits compared by value), never from the collation data of the runtime: two builds on two versions of Node.js order the same titles the same way. A language pack exposes the `collation` options it compares with in place of an `Intl.Collator`.
- 641870f: `I-TERM-HOMONYM` lands on the note of the first entity sharing the form (glossary first), carries its source, path and identifier, and cites the form as that note writes it instead of the comparison form; `DictionarySource` may carry the `path` of the note.

### Patch Changes

- 4234308: Two keywords sharing a slug take their addresses in code-unit order of the keys, never by score, so that the address of a keyword page depends on the published keys alone; a local source holding the cache or the output folder (`path: .`) never reads back what the build wrote; a stopword file the configuration names but does not exist is an error `validate-config` and `build` report before anything starts, instead of an exception of the pipeline.
- 070a176: A type prefix of several words (`data object`) announces its type, the longest prefix first, and a prefix separated from the mention by punctuation announces nothing; the context of an occurrence never cuts a surrogate pair or a combining mark at its edges; `concordance toString` is an unknown command, not a stack trace.
- ccbf0fc: Every published schema is read and compiled once per process (`compiledSchema` in the core package) and its validator shared: reading the thirty-five type modules of the default profile takes a seventh of the time, validating a configuration a fifth, and every command starts faster; `readSchema` returns the same schema object on every call.
- 4833f68: `yaml` is pinned to 2.8.3 and `ajv` to 8.18.0, the versions that close the two moderate advisories `pnpm audit` reported (a stack overflow on a nested sequence of a few kilobytes, which the frontmatter of any note could carry; a ReDoS on `$data` references, unused here).
- Updated dependencies [e5ca327]
- Updated dependencies [524f45d]
- Updated dependencies [b6a5530]
- Updated dependencies [da662fd]
- Updated dependencies [8b2155e]
- Updated dependencies [6d7208b]
- Updated dependencies [7e5a9b1]
- Updated dependencies [1f66f9f]
- Updated dependencies [4234308]
- Updated dependencies [5e137bf]
- Updated dependencies [a470bd4]
- Updated dependencies [ab7dd44]
- Updated dependencies [78f7248]
- Updated dependencies [30da51f]
- Updated dependencies [7359a7b]
- Updated dependencies [ccbf0fc]
- Updated dependencies [23d6f77]
- Updated dependencies [7953b7d]
- Updated dependencies [21ea529]
- Updated dependencies [ee74348]
- Updated dependencies [4833f68]
  - @concordance-wiki/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [6a4fcf6]
  - @concordance-wiki/core@0.3.1

## 0.3.0

### Patch Changes

- f8aad74: A local source, a stopword file and the locations of the global lint block are resolved as the platform resolves paths: on Windows a `path` source relative to the configuration was reported unreachable.
- Updated dependencies [7c56d0a]
  - @concordance-wiki/core@0.3.0

## 0.2.0

### Patch Changes

- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.
- Updated dependencies [90cdb13]
- Updated dependencies [678b2f8]
- Updated dependencies [0adb9b5]
- Updated dependencies [dbabd01]
- Updated dependencies [e7ab68f]
  - @concordance-wiki/core@0.2.0

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
