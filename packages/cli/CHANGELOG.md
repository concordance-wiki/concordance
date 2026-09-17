# @concordance-wiki/cli

## 0.4.1

### Patch Changes

- 2772a81: `ajv` 8.20.0 and `yaml` 2.9.1, the minor releases Dependabot proposed, with the licence inventory regenerated.
- 73c6413: The build accepts the version it records as the tool's from its dependencies, so that fixtures built in memory never change with a release.
- Updated dependencies [2772a81]
- Updated dependencies [4f15eff]
  - @concordance-wiki/core@0.4.1
  - @concordance-wiki/inference@0.4.1
  - @concordance-wiki/ingest@0.4.1
  - @concordance-wiki/lint@0.4.1
  - @concordance-wiki/nlp@0.4.1
  - @concordance-wiki/profile@0.4.1
  - @concordance-wiki/site@0.4.1
  - @concordance-wiki/typing@0.4.1
  - @concordance-wiki/checks@0.4.1

## 0.4.0

### Minor Changes

- a851604: `concordance build --timings` prints, after the summary, how long each phase of the build and each step of the pipeline took; the figures never reach the log or the model.
- 587ea09: `concordance mcp` serves the questions of `query` to an agent over the standard input as tools of the model context protocol, one tool per family (`lookup`, `search`, `relations`, `list`, `corpus`, `passages`), without state, key or network; `distribution/mcp/mcp.json` is the configuration a harness reads to start it.
- 78f7248: `concordance query <expression>` prints what the model knows about an expression, without the site: the note it names, resolved as the recognition reads it (identifier, title or alias, normalised form, prefix; a term wins among candidates), where it is used with file, line and context, what it is linked to with relation, confidence and methods, and the decisions and sessions among those links; `--format json` follows the new `query.schema.json`.
- fddad56: `concordance query` answers the questions of the whole corpus: `--stats`, `--sources`, `--domains`, `--undefined [<expression>]` with `--min-files`, `--recent` with `--since` and `--source`, `<expression> --changed-with`, and `--findings` about an entity or under `--check`.
- 30da51f: `concordance query` reads one section alone (`--occurrences`, `--links`, `--related`), walks the way to another entity (`--path <target>`, `--max-depth`), lists the entities of the model (`--list` with `--type`, `--domain`, `--application`, `--source`, `--status`, `--all`), and finds its model through `concordance.yaml` of the working directory or `--config`, then through the published model of `concordance-lint.yaml`, when `--model` names none; options that do not go together are refused by name.
- 7d4b9a5: `concordance query --text <phrase>` finds where a phrase is written or spoken: the positions of the converted documents and the transcripts, with page, slide or timecode and speaker, and the sections of the notes, from the fragments next to the model.
- 2caceac: `concordance query` narrows the links of an entity with `--direction in|out` and `--relation <slug>`, lists what lies within `--radius` links with `--near`, and explains why two entities are linked with `--explain <target>`, every provenance of every link between them shown with its place and context.
- 6c7d540: `concordance query --search <words>` runs the search of the site from the command line, with the same ranking and facets as the results page, from the index the site wrote, else from the model and its fragments, else from the model alone; `--keywords-only` and `--no-keywords` filter the keyword pages. The search index takes the English labels when nobody gives it any.

### Patch Changes

- 7863128: `concordance build` reaches the network through the `fetch` of the command io alone, as `lint` does: a caller that gives none forbids every connection; the gallery reads the type modules of the core through the injected file system.
- e5ca327: The caches survive an interrupted build: the node file system writes next to the destination and renames, so a file is whole or absent; a text representation or a cached contract that is not JSON reads as absent and is extracted again (the build reports a text representation it cannot read, instead of stopping on the raw error); a contract reader declares the `cacheVersion` of the shape it extracts, and a contract cached under another version is read again; the work folder of a conversion is removed whatever happened in it.
- b6a5530: A contract path that leaves its source (absolute, or climbing above the root) is refused with a `W-CONTRACT-UNREACHABLE` whose message names no path of the machine, and is never copied under the output; a contract URL pointing at the build machine, its link-local neighbours or a private network is never fetched. `contractPathIn` and `refusedContractUrl` are exported by the core package.
- da662fd: The credentials a URL carries never reach a published file: `model.json` records the git URL of a source without them, and the finding of an unreachable source strips them from what git echoed (`withoutCredentials` in the core package).
- 641870f: `I-TERM-HOMONYM` lands on the note of the first entity sharing the form (glossary first), carries its source, path and identifier, and cites the form as that note writes it instead of the comparison form; `DictionarySource` may carry the `path` of the note.
- 4234308: Two keywords sharing a slug take their addresses in code-unit order of the keys, never by score, so that the address of a keyword page depends on the published keys alone; a local source holding the cache or the output folder (`path: .`) never reads back what the build wrote; a stopword file the configuration names but does not exist is an error `validate-config` and `build` report before anything starts, instead of an exception of the pipeline.
- aad2e49: `concordance lint` reads and validates `concordance-lint.yaml` once per run and shares it with the fixes, the local checks and the global scope, instead of reading it in each; `lintRepository` and `fixRepository` accept the overrides already read.
- 7e7569f: `lint --scope global` reads the profile the wiki configuration names when `--config` gives one, with its `types_dir`, as the build does, so that `E-META-REL` judges the same pairs against the same matrix; `global.profile` of `concordance-lint.yaml` still replaces it.
- 5e137bf: A plugin declared by a path (`./plugins/theme/index.js`) is resolved against the folder of the configuration file by every command: `build` imported the path as written and failed where `render` succeeded, and `render`, `init --templates` and `gallery` resolved it against the working directory.
- 070a176: A type prefix of several words (`data object`) announces its type, the longest prefix first, and a prefix separated from the mention by punctuation announces nothing; the context of an occurrence never cuts a surrogate pair or a combining mark at its edges; `concordance toString` is an unknown command, not a stack trace.
- 23d6f77: A document over `conversion.max_size_mb` is no longer read and hashed before the converter refuses it: the build checks its size first (`size` joins the file system interface) and reports the same `W-CONV-FAILED` without reading a byte.
- c09877d: `concordance --help` names `--fix` and `--dry-run` among the options of `lint`, and the command-line guide carries the same usage text, checked by the validation.
- 4833f68: `yaml` is pinned to 2.8.3 and `ajv` to 8.18.0, the versions that close the two moderate advisories `pnpm audit` reported (a stack overflow on a nested sequence of a few kilobytes, which the frontmatter of any note could carry; a ReDoS on `$data` references, unused here).
- Updated dependencies [e5ca327]
- Updated dependencies [ea6f439]
- Updated dependencies [524f45d]
- Updated dependencies [2f298b0]
- Updated dependencies [1131d78]
- Updated dependencies [b6a5530]
- Updated dependencies [da662fd]
- Updated dependencies [8b2155e]
- Updated dependencies [6d7208b]
- Updated dependencies [7e5a9b1]
- Updated dependencies [1f66f9f]
- Updated dependencies [641870f]
- Updated dependencies [4234308]
- Updated dependencies [6e50d62]
- Updated dependencies [aad2e49]
- Updated dependencies [7e7569f]
- Updated dependencies [4a5bb95]
- Updated dependencies [a5ca382]
- Updated dependencies [5e137bf]
- Updated dependencies [a470bd4]
- Updated dependencies [070a176]
- Updated dependencies [594a75f]
- Updated dependencies [ab7dd44]
- Updated dependencies [78f7248]
- Updated dependencies [30da51f]
- Updated dependencies [6c7d540]
- Updated dependencies [aa89964]
- Updated dependencies [0d9a39b]
- Updated dependencies [7359a7b]
- Updated dependencies [ccbf0fc]
- Updated dependencies [23d6f77]
- Updated dependencies [7953b7d]
- Updated dependencies [64ca6e5]
- Updated dependencies [21ea529]
- Updated dependencies [ee74348]
- Updated dependencies [4833f68]
  - @concordance-wiki/core@0.4.0
  - @concordance-wiki/checks@0.4.0
  - @concordance-wiki/nlp@0.4.0
  - @concordance-wiki/site@0.4.0
  - @concordance-wiki/inference@0.4.0
  - @concordance-wiki/ingest@0.4.0
  - @concordance-wiki/lint@0.4.0
  - @concordance-wiki/profile@0.4.0
  - @concordance-wiki/typing@0.4.0

## 0.3.1

### Patch Changes

- 6a4fcf6: The `duplicates` block of `build.log.json` no longer carries `timeMs`, so that nothing in the log depends on the clock but its `at` field; the console summary still prints the measured duration of the twin-resource reconciliation. A missing theme file is told apart from an invalid one by a `missing` flag on the failed load rather than by the text of its message; the exit codes and the messages are unchanged.
- Updated dependencies [6a4fcf6]
- Updated dependencies [456a5a0]
- Updated dependencies [0a4f169]
- Updated dependencies [2f3037c]
  - @concordance-wiki/core@0.3.1
  - @concordance-wiki/site@0.3.1
  - @concordance-wiki/lint@0.3.1
  - @concordance-wiki/checks@0.3.1
  - @concordance-wiki/inference@0.3.1
  - @concordance-wiki/ingest@0.3.1
  - @concordance-wiki/nlp@0.3.1
  - @concordance-wiki/profile@0.3.1
  - @concordance-wiki/typing@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [7c56d0a]
- Updated dependencies [08e61ba]
- Updated dependencies [f8aad74]
  - @concordance-wiki/core@0.3.0
  - @concordance-wiki/ingest@0.3.0
  - @concordance-wiki/site@0.3.0
  - @concordance-wiki/nlp@0.3.0
  - @concordance-wiki/lint@0.3.0
  - @concordance-wiki/checks@0.3.0
  - @concordance-wiki/inference@0.3.0
  - @concordance-wiki/profile@0.3.0
  - @concordance-wiki/typing@0.3.0

## 0.2.0

### Minor Changes

- 90cdb13: `inference.domains.max_neighbours`: the degree above which a term is a hub of the corpus rather than a domain and never a pivot. Without it the most cited words of a corpus win every tie and every proposal names them. A proposal now names the pivot's own domain when something files the pivot, so that an unclassified note joins the domain of the terms it is close to; a domain named after the pivot only when the pivot itself is unclassified.
- 678b2f8: Emergent domains proposed from the neighbourhood: `inference.domains` names the terms with enough neighbours as pivots and reports every unclassified note within the radius as `I-DOMAIN-SUGGESTED`, listed in the build log, assigned only under `assign`; the lock file promotes a proposal under `domains`, and every entity records the origin of its domain under `domain_origin`.

### Patch Changes

- f42ff24: The entity page shows a domain the build proposed in italics, with a tooltip saying so; the unclassified finding of a transcript or a deck grouped into a note the proposal or the lock filed is answered with the note's.
- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.
- 5d2fd8c: The twin resources are reconciled before the recognition dictionary is built: a document folded into its note no longer enters the dictionary as a second entity of the same title, so the shared title yields no `I-TERM-HOMONYM`, its occurrences are read at full confidence and the co-occurrence rows of the folded twin count on the merged entity.
- Updated dependencies [5b2a0a3]
- Updated dependencies [90cdb13]
- Updated dependencies [678b2f8]
- Updated dependencies [0adb9b5]
- Updated dependencies [9599fef]
- Updated dependencies [f42ff24]
- Updated dependencies [dbabd01]
- Updated dependencies [e7ab68f]
  - @concordance-wiki/site@0.2.0
  - @concordance-wiki/core@0.2.0
  - @concordance-wiki/inference@0.2.0
  - @concordance-wiki/checks@0.2.0
  - @concordance-wiki/typing@0.2.0
  - @concordance-wiki/lint@0.2.0
  - @concordance-wiki/ingest@0.2.0
  - @concordance-wiki/nlp@0.2.0
  - @concordance-wiki/profile@0.2.0

## 0.1.0

### Minor Changes

- 203133d: The about page, `about/index.html`, linked from the footer of every page: the site is rebuilt at every change of the repositories and not edited here; the build instant, the pages and the indexed words counted; every repository with its nature, the commit the build read, what was kept and its newest change, a dormant one dated in the accent and named under the table; what the site does not contain and how a page is corrected, with `project.contribute_url` and a word on pseudonymisation when the configuration says so. The new key `project.about` names a markdown file whose sections follow the generated content. New `About` slot, `about.*` messages, gallery states `about-corporate` and `about-sections`.
- a0e7d01: Alphabetical index segmented by letter: the entries follow the collation of the project locale, which `concordance build` and `concordance render` take from its language pack and pass to the site as `collate` (an `Intl.Collator` of the locale, accents folded and digits by value, when a caller passes none), so that `étude` files between `estimate` and `event`; a letter without an entry is visibly inactive, without a link, and an active letter leads to its anchor in the whole index, whose first entry per letter carries an `anchor`; when the whole index rendered as one page weighs more than 100 kB (`INDEX_SEGMENT_BYTES`), every letter with entries gets `index/<letter>/index.html` (`index/other/index.html` for titles opening with a digit or a symbol), `index/index.html` shows the first of them and every letter page links to its siblings, each page under the budget on a corpus of three thousand notes; the home page links each letter to its place in the index.
- 79c8264: Serialised canonical model: `assembleModel` puts the build block, the entities, the links with their provenances, the findings and the candidates in canonical order, `serializeModel` writes them as canonical JSON, `parseModel` and `validateModel` check a model against the published `model.schema.json` (which now requires the entity locale and source line, closes the provenance objects and records the URL of a git source), and `toCypher` exports the graph as a Cypher script; `concordance build` loads the profile, types the notes, resolves the written links, writes `dist/model.json` next to the log and counts entities per type and links per method in the summary, and `concordance export --format cypher` writes the Cypher script of a model.
- c9a8fbc: Component gallery: `concordance gallery [--output dir] [--theme plugin] [--config file]` renders every slot with fixture view models into a static page set, an index naming the plugin and theme behind every overridden slot, the island bundles and the stylesheet next to the pages, and fails on a page over budget or on an accessibility finding; the site package ships the fixtures (`galleryFixtures`), the page set (`galleryPages`), `buildGallery`, `renderDocument` and a static accessibility checker (`checkAccessibility`) with nine structural rules that the site tests run on every gallery page.
- 5c7f7e8: Add the `concordance` preset package, the container image built from it and the pipeline that verifies the image; the command line exposes its executable as `@concordance-wiki/cli/bin`.
- ce3bc7c: Contract viewer: the page of an `api` entity whose contract was imported shows the contract after the note without copying it into the markdown, as a static section (title, version, import date, the operations as a plain list, a "Download the contract" link to the declared URL or to the copy of a path contract placed next to the page) and a `contract-viewer` island that fetches `fragments/<api id>.contract.json` on demand only and renders an expandable operation list and a schema explorer for HTTP and SOAP contracts alike, with no form and no request to the API described; the contract loader of the core writes that view next to the cached contract at every load (`ContractView`, `cachedContractViewPath`), the OpenAPI and WSDL readers now keep the parameters, request and response types and the referenced schema definitions for it, the build copies the view and the path contract under `fragments/` and `render` places them; the viewer is the first UI component contribution of the default theme (`defaultThemeManifest`), registered as a built-in ahead of the declared plugins (`builtin` in the plugin loader dependencies) so that the registry lists it and no plugin claims its slot, and the site bundles the UI components a plugin contributes next to its own islands.
- 24a33f7: Reproducible builds: `SOURCE_DATE_EPOCH` pins the clock of the command line (`epochClock` in core), `compareLinks`, `compareProvenances` and `sortCanonically` give links and provenances their canonical order next to findings, and a double-build test plus the determinism step of `pnpm check` compare every output file of two builds of the golden corpus byte for byte.
- 7d514b3: Document page of the default theme: the page of an office document, a deck or a report, alone or merged with its note, opens on the document, with the tree of its space folded by year when the space is a space of dated documents, the line naming the kind, the page count, the size and the date read from the file, the tabs "Document", "Extracted text" and "Related notes" as anchors that work without any script, "Download the original", the strip of numbered pages driving the viewer opened as soon as its script runs and the browser's own PDF viewer without JavaScript, the properties read from the file and the files that make the document in the panel; the viewer's toolbar becomes the counter, the zoom between its two signs and the find field; the fragment of a document carries the size of the original and the author, the date and the page count its reader exposed; the `document.*` messages in both catalogues.
- e298d7d: Document viewer: the page of an entity with documents lists each file for download (`<a download>`), links its PDF, draws a rail of its pages, slides or cues captioned by the first line of their extracted text and serves that text position by position in disclosure blocks anchored as the mentions cite them, all without JavaScript; a `document-viewer` island of plain JavaScript reveals an "Open the viewer" button that imports the `viewer-pdf` bundle on demand, built from the legacy build of pdf.js with its worker as a second bundle, and opens the PDF on a canvas with previous and next, zoom steps and a find box over the extracted text that jumps to the first matching page; the two viewer bundles are built only for a site that shows a PDF, are announced in the build summary with their size and are never referenced by a page's scripts or preloads, their hashed names travelling in the island props; when the import fails, over `file://` in browsers that refuse module scripts from the disk, the reader gets a link to the PDF; image thumbnails per slide come with the converter's thumbnail output, the rail names the slides by their text until then; `concordance render` places the original files and the PDFs the build kept under `fragments/<id>/` next to the pages.
- 1f18480: Concordance as its own example: the note templates copied by `concordance init --templates` describe the tool (the keyword page, the publication threshold, the model query contract and the forge bridge WSDL), the sample configuration written by `concordance init` names a `publication` domain, and the component gallery shows Concordance pages; the guides, check pages, specification samples and README mockup use the same vocabulary.
- af10923: Edge cases, what shows when something is missing, under one rule: the cause named in plain words, never a code alone, what stays reachable said, two exits at least, the navigation kept. The build writes `404.html`, the page GitHub Pages and GitLab Pages serve for any missing address under the site, with the chrome of every page, the likely causes, the search of the documentation and the list of the spaces; its head names its own address as a base from the new `site.url` key, the root of the host without it, and its `not-found` island words the search on the last segment of the address and lists the nearby addresses by edit distance on the path, from the entity table of the search index (`NotFound` slot, `notFoundOf`, `wireNotFound`, `nearbyOf`). The empty results page tells a word the filters left out (one exit per filter with the count lifting it gives back) apart from a word no file uses (the closest form and the line on the prefix search), the page of the word itself an exit when the corpus has one (`EmptyResults`, `emptyOf`). The notice of a page whose datum is missing is one component, `PageNotice`, the only banner of the site: an `api` whose declared contract could not be read names the fact under its title (`contractNoticeOf`, `EntityPageProps.notice`), and a document whose conversion failed, the `W-CONV-FAILED` finding recorded for its path, shows in place of its rendering the notice naming the fact, what remains, the original to download and the finding behind a disclosure, the cause first and the check after it, then the extracted text when it was read; the panel writes the state of every representation (`DocumentView.previewFailure`, `DocumentPageView.representations`). With the new `site.publish_every_days` key, every page carries a notice on the age of the site, served hidden, which the `age` island shows past three times the cadence, the days counted in the browser; closing it keeps it closed for that publication (`AgeNotice`, `RenderOptions.notice`). The gallery gains the edge-cases board with the states `not-found-corporate`, `not-found-nearby`, `search-results-filtered`, `document-page-no-preview` and `age-notice`.
- 728ca5d: Markdown-first entity page: badge and highlights, title, the note as an article with written links and recognised words marked and a legend, metadata in the side panel, repository images copied next to the page, and a footer naming the source file with an edit link to its GitHub or GitLab forge.
- 050d8a7: Extracted text indexed: `concordance build` gains a documents step that reads every file a reader or a converter of the plugins accepts, types it as an entity (identifier with its extension, metadata as attributes, the source rules and their `ext` matches applied), converts office documents to PDF in parallel (`conversion.parallelism`, `convert: false` per source) and takes their text from the pages of that PDF only, so that there is a single extraction path; the `convert-libreoffice` plugin produces a `text` representation (`<sha256>.text.json`, one entry per page) next to every PDF and a second converter keeps `.pdf` sources as their own representation; the `reader-vtt` plugin returns `units`, one per speaker turn with its timecode, a new optional field of `ReaderOutput`; the scan, the keyword discovery and the twin reconciliation read the pages of the documents, an occurrence in a document carrying the page, slide or cue number as its line and its label as its section, so that the mentions panel cites `slide 3` or `00:12:05` instead of a line; a document that still has no markdown representation once the twins are reconciled yields `W-DOC-NOMD`; the fragment of an entity lists its `documents` with the text of every page cut at `build.extracted_text_max_chars` and joined as its `text`, and the build keeps the original file and its PDF under `fragments/<id>/` for `render` to place next to the page; a failed conversion counts for `build.fail_on.unconverted_max`.
- b17e66c: Tolerate content anomalies through findings: every finding now carries a remediation; `build` parses every markdown file after ingestion, turns unreadable files and broken frontmatters into findings without stopping, writes the summary and the sorted findings to `build.log.json` under the output folder (`--output`, `build.output` or `./dist`), prints the summary, and fails only according to `build.fail_on` (`summarize`, `shouldFail` and `serializeBuildLog` in core).
- ee71a72: The footer of every page distinguishes what the tool knows from what the organisation declares: a card in two columns, "This site" with the build instant, the repositories counted and linked to the spaces page, the generator and its licence, then "Declared by the organisation" with the legal notice, the accessibility statement and the personal data page, shown only when the new `project.legal` keys (`mentions_url`, `accessibility_url`, `accessibility_status`, `privacy_url`) or a note at `legal/<page>.md` declare them, the accessibility link carrying the declared state and nothing else, followed by the `footer.text` and `footer.links` of the theme; under the columns the build line names the profile, counts the pages and ends on the to-do link. `footer.credit` now names the tool inside the sentence of the generator. The `Footer` slot receives its strings worded on `labels`; the `footer.*` messages are rewritten; gallery states `footer-corporate` and `footer-alone`.
- 21293ea: Reports for forges: `concordance lint --format json|sarif|junit` prints the findings as a JSON document with the documentation URL on each finding and the counts, as a SARIF 2.1.0 log with one rule per check and one result per finding located by file and line for the diff margin, or as a JUnit suite with one failing test case per error or warning; `--output <file>` writes the report to a file instead of standard output, and the exit codes follow `--fail-on` whatever the format (`formatFindingsAs`, `formatJson`, `formatSarif` and `formatJunit` in the lint package).
- c1e8b5b: Component gallery as a workbench: one state per board of the reference design in the corporate chrome, the to-do page included, with the degraded cases beside them (a corpus of one source, a note without a property, passages without a timecode, a contract that could not be fetched, every island-bearing page served without its scripts); the index groups the states by board with their captions and the screen notes of the demonstration, frames every state at the width of its board (390, 834 or 1440 px, `width` on the page entry) and offers a width switch as a classic island; `skeletonOf` reduces a page to its structure and one file snapshot per state pins it.
- e20e743: Global lint without rebuilding: `concordance lint --scope global` reads the published `model.json` named by `global.model` in `concordance-lint.yaml` (a URL cached under `global.cache_dir` for `global.max_age_hours` and revalidated with `ETag` and `Last-Modified`, or a local path) and checks the local notes against its entities: `E-LINK-BROKEN` and `W-LINK-CROSS-SOURCE` for links into other sources, `E-META-REL` for frontmatter references against the profile matrix, `I-TERM-HOMONYM` for titles and aliases shared with an entity of another type; an unreachable model degrades to the local checks with one line on stderr and `degraded: true` in the JSON and SARIF reports; `lintGlobal`, `loadPublishedModel`, `globalFindings`, `GLOBAL_CHECKS`, `mergeFindings` and `readLintConfig` are exported, and the model's `build` block records `cross_source_links`.
- 4bf8607: Home page with three entry points: the number of sources and files with the date of the build spelled in the project locale, a search region (`data-slot="search"`) with the twelve most cited pages as shortcuts, a note counted by the links pointing at it and a keyword page by its occurrences, then three entry points of equal standing: the file tree, one folding block per source with its folders and notes; the letters of the alphabetical index with their counts; the twenty latest changes with their git date and the freshness of every source, flagged dormant when its newest change is older than `staleness.warn_after_days` (180 days by default), which `concordance build` and `concordance render` now pass to the site; a link to the to-do page with its count; no dashboard, no metric, no chart. The `Home` view model gains `builtAtLabel`, `dateLabel`, `tree`, `sources` and `todo`, and the entry `href` becomes optional; the catalogues gain `home.tree`, `home.index` and `home.recent`.
- a1c0353: API page: the contract viewer opens in the page as soon as its script runs, the link to the JSON view standing in until then and without JavaScript, and the download link moves to the foot of the contract block; the meta line dates the contract by the last change of its file, as the ingest dates it, the import instant only for a contract fetched from a URL; the operations table and the tree of the space list the operations in the order of the contract. The contract record of the model carries the operation names in declaration order (`operations`) and, for a contract read as a file, its `last_modified`; the pipeline hands every source plugin the dates of the ingested files (`SourcePayload.dates`).
- 1bbfecc: The context of an occurrence and of a discovered expression quotes the unit as written, the inline code the scan skips put back in place, so that an excerpt never shows a hole where a code span stood; the keyword page groups the passages by page, two excerpts in view per page and the rest behind a fold, six pages in view and the other files behind a disclosure, as the reference design lays them out.
- b9e4031: Word confidence: every keyword candidate carries a confidence in [0, 1], the product of five signals read from the shape of its distribution in the same pass as the score (spread across the files, occurrences per file, prominence in headings, written links and frontmatter, the company of a defined term, the inflected-form suffixes of the language pack's new optional `suffixes.txt`), with its measures as `signals` and the lowering signals as `penalties`; `inference.keyword_pages.min_confidence` (0.5 by default, validated in [0, 1]) joins `min_occurrences` and `min_files`: an expression under it gets no page nor mark in the text, stays searchable and is recorded as `withheld` in `model.json`; the build summary prints `expressions set aside by confidence`, and every keyword page carries its confidence among its attributes. The to-do page lists the words a hundred at a time, the others behind a "Show the N others" disclosure served in the HTML, and folds a third section, "Suspected noise", listing the withheld expressions best score first with their counts and their reason worded in the language of the site ("in 68% of the files, 1.2 per file, verb or adverb form"), none linked, with a call to add them to the project's stopwords leading to `project.contribute_url`.
- d5dc4b0: Keyword page on the shell of the entity page: a banner saying that no note exists with the number of passages and a lead to create the note on the forge of the glossary, the three counts, the passages grouped by file in corpus order with the expression marked, the accompanying words from the co-occurrence of the expression sized by rank, the expressions of a similar form offered as a lead, and a forwarding page that keeps the address of a keyword once a note defines it.
- 34c5a53: Keyword page publication threshold: `publishKeywords` splits the discovered candidates into the pages to generate under `keywords/<slug>` and the expressions discarded by `inference.keyword_pages` (`keywordPublicationOptions`, three occurrences in two distinct files by default), which stay in the output for the search index without a page; `keywordEntities` turns each page into a `term` entity marked `keyword: true` located on its first mention; the build summary gains the optional `keywords` counts, which the build prints as `keyword pages` and `expressions under the threshold`.
- b092a63: Spaces pages of the default theme: `spaces/index.html` lists every space in one table, the most cited first, with its initials badge and its name, its content (the new `sources[].description` of the configuration, else the labels of its dominant types), its page count and its newest change from the git history, a space past the staleness threshold dated in the accent and in days; `<source>/index.html` is the page of one space, where the rows of the home page, the "Spaces" link of the bar, the drawer and the breadcrumbs now lead: the breadcrumb from the spaces page, the badge, the title, the declared description and the line counting the pages, naming the repository and dating the newest change, the categories of the repository (its top-level folders with their counts, each opening the page the tree lists first under it), the four latest changes with their category, the five most cited words counted in the space only, a keyword page among them dashed, and the sentence closing the page; the search field of the bar on a space page says "Search in this space" and carries the space as the source facet, its live results keeping to the space; the `Spaces` and `Space` slots, the `spaces-corporate` and `space-corporate` gallery states, the `space.*` and `spaces.*` messages in both catalogues; the rows of the home page no longer fold a tree.
- 8727aae: Distribute the linter in six forms that run the same command line and produce the same report: the `npx` package, a standalone binary built as a Node.js single executable application (`pnpm build:binary`), a GitHub action, a GitLab CI/CD component, the container image and a pre-commit hook, with a workflow that compares their reports on the faulty corpus.
- 3fb3d96: `concordance-lint.yaml` gains an `exclude` key, globs of the files of the repository that are never read, counted or reported, with the syntax of `privacy.exclude`; the file is validated against a published `lint.schema.json`, documented by a generated reference page. The files git ignores are left out the same way, every `.gitignore` of the repository being read with the rules git applies, and `concordance lint --no-gitignore` checks them anyway. The build lists the files of a source exactly as the linter does, honouring the `exclude` of the repository and its ignore files, and skips with a `W-SOURCE-UNREACHABLE` finding a source whose lint configuration is faulty; the parity test holds it on an excluded folder and an ignored file of the faulty corpora.
- cfc0835: Navigation: every folder of a space, at every depth, gets the list of its notes at its address, and a space whose every note is dated gets one per year and per month; every folder of the space tree and of the breadcrumb links to its list, the head of the tree in the left column links to the page of the space, and the list of a folder below the top leads with "N pages filed under rules › links". The configuration gains `sources[].title`, `sources[].folders` (a title and a description per folder path) and `project.contribute_url`, validated by the schema: every call to action, "Propose a definition" and "Edit this page", leads to the forge when a link can be built, else to `project.contribute_url`, and is not shown otherwise; the path of the file under a note links to the file on its forge. The line under the title of an entity page reads "Space <title>" linked to the page of the space (`entity.inSpace`), the type chip leads to the results filtered on the type, and the application and the domain of the panel read by their titles and lead to the results filtered on them.
- 3ae5687: Local lint without network: `concordance lint --scope repo` checks the current repository file by file (UTF-8 encoding, YAML frontmatter, identifiers unique once the source's type suffixes are stripped, internal links) with the rules of the source named by `--source` and the `checks` overrides of `--config` and of a `concordance-lint.yaml` at the root, prints the findings sorted with their documentation URL and their counts, and exits according to `--fail-on`; `--fix` and `--scope global` are refused until their stories land.
- efb8c03: The build reads the lock file `lock` names, validates it against the lock schema and applies its decisions: `rejected_terms` leave the keyword discovery, compared on the normalised form of the language pack, and the `merged` and `separated` pairs of `duplicates` reach the twin resolver whatever the score. A missing or invalid file stops the build like a configuration error; the summary and `build.log.json` count the decisions applied under `lock`; `validate-config` says that the links of the file are recorded, not read.
- 2fe703f: Lay the page of a meeting out on the shell of the entity page: the tree of a space whose every note is dated drawn by year and month with the breadcrumb naming the month, the line reading the type, the duration (the `duration` attribute, else the last cue of the transcript) and whether the participants are pseudonymised, the representations as anchor tabs the stylesheet shows one at a time without any script, the transcript as timestamped lines naming the speaker of every cue, the callout of the decisions the model links to the meeting, and in the panel the date, the duration, the space and the grouped files with why the build grouped them, read from the duplicates block of the model. A reader unit and the pages of a fragment now carry the `speaker` of a transcript cue, the site receives `privacy.pseudonymize.enabled` as `pseudonymized`, the catalogues gain the `meeting.*` messages and `formatMonthName` names a month alone.
- 5f8e108: Mentions panel in two sections, written links and recognised mentions, grouped by citing file in collapsible groups; the first `build.mentions_inline` mentions in the served HTML, the rest in one `fragments/<id>.mentions.json` per entity, embedded in the page under two hundred mentions and fetched on demand beyond; the island adds sorting, filtering and a collapse-all; occurrences and mention provenances carry the matched text and its passage.
- 2a4157b: Note templates: `concordance init --templates` copies the shipped note templates (one per active type of the default profile, their index and the example contract) into `templates/` of the configuration repository without overwriting a file, `templatesDirectory()` locates the copy the package ships, and tests verify that every template lints clean, resolves to its type through the cascade and equals `docs/templates`.
- 66d7b33: `concordance build` runs the whole inference chain and exits 0 with a complete `model.json`: after ingestion, parsing and typing, the source plugins import their contracts, one recognition dictionary per locale is built, every note is scanned, the written links, frontmatter references, mentions and co-occurrences are produced and combined, the keyword pages are discovered and published, the markdown notes are reconciled as twin resources, the model checks of the registry run and every finding of every step is enriched and written once; `packages/cli/src/pipeline/` holds one module per step, the relation typing step calling `typeRelations` of the inference package. The build prints `render: not available in this version` instead of stopping with exit code 2, the summary and the log gain the keyword and twin-resource counts, and the model gains `build.contracts`, `candidates.objects` and `displayed_neighbourhood`, sorted by `assembleModel`. A `related` link that co-occurrence alone knows no longer raises `I-REL-AMBIGUOUS`. Keyword discovery leaves out the headings and the section labels a list item opens with (`- Reads:`): titles, not usage. A frontmatter reference to an existing note of a type the attribute does not accept gives its link, which the relation typing step drops with `E-META-REL`, instead of `W-REF-UNRESOLVED`. A `CheckLink` may carry its provenance: `W-API-CONSUMER-MISMATCH` counts as citations only the `serves` links read outside the API note, reads the `## Consumers` section as a declaration next to the attribute, and resolves declared consumers relative to the source of the note. A mention keeps the confidence the scan gave it (type prefix bonus, homonym factor) and the combined glossary confidence grows from the strongest occurrence. The default profile gives the `decisions` attribute of a meeting the `documents` relation.
- c995c47: Pseudonymisation is applied by the build: the dictionary of `privacy.pseudonymize` is read and validated (`W-PRIVACY-DICTIONARY` when it is missing or malformed, an error that fails the build and withholds every transcript when pseudonymisation is enabled), every transcript is pseudonymised before typing in its cues, its metadata and the file offered for download, which readers write back through a new optional `rewrite` (implemented for VTT and SRT; `W-PRIVACY-WITHHELD` for a reader without it), the notes and documents of the scope types are replaced the same way, the real names are rejected from keyword discovery, and transcripts are withheld altogether unless `privacy.publish_transcripts` is true.
- 91c3305: Safe automatic fixes: `concordance lint --fix` adds the type deduced from the source rules to a frontmatter that has none, orders the frontmatter keys canonically and points a link to a missing file at the only file carrying that name, announcing every change before writing and refusing an ambiguous one; `--dry-run` lists the changes without writing. The lint package exports `fixRepository`, `normalizeFrontmatter`, `rewriteRenamedLinks` and `deduceType`.
- cc77d53: Create the packages with their entry points and the build toolchain.
- f6dea3f: The note of an entity page draws its tables as cards and every image of the sources on a line of its own as a figure with its caption, the note "Image of the repository, shown in the flow of the text" and the path of the file; the related pages come written links first, then by number of passages; the properties note counts the declared keys and the legend stands at the foot of the article; a gallery state shows the entity page screen of the fixtures corpus with its table and its sketch.
- 23617d8: Search index generated at build: `buildSearchIndex` tokenises the title, aliases, summary, body (cut at `build.extracted_text_max_chars`), type, application, domain, status and source of every entity with `searchTokens` of the language packs, and `searchIndexFiles` writes it under `search/` as classic scripts, one shard per two-character prefix and an entity table, so that the `search` island loads them in pieces as the reader types from a `file://` page as well as behind a server; the header field of every page suggests the best results, `/` reaches it and `Escape` leaves it, and `search/index.html` lists the results of the query in its address; the fragments carry the plain text of the note, `SearchResult` gains a `breadcrumb`, islands can be bundled as classic scripts, and the build summary reports the weight of the index and its number of shards.
- c5048be: `concordance build` renders the site after the model and `concordance render` renders it again from `model.json` and the `fragments/<id>.json` written next to it, without touching a source: one `<id>/index.html` per entity and per keyword page with the note rendered to sanitised HTML, the home page, the alphabetical index, the to-do page, a search index placeholder and the assets, every href relative to its page so that `dist/` works over `file://` as behind a server, every page measured against the 150 kB budget and checked for accessibility, byte-identical from one rendering to the next. The site package gains the markdown renderer, the fragment format and the shared site assembly the gallery now uses; core orders the displayed neighbours by rank, then confidence, as the display step does; inference exposes `locateLink`.
- cc3beed: Fetch sources into the cache at depth 1, or update them when already cached, without ever writing into a repository; record the last commit and modification date of every file; accept local folders; apply `privacy.exclude` before reading anything; report an unreachable source as `W-SOURCE-UNREACHABLE` and go on.
- cbe8fcd: Three marks in the text of a note: a written link, a recognised word with a note and, new, a recognised expression that has a keyword page and no note, dashed in grey and linked to its page; a page is marked once per note, on its first occurrence, every mark carries a title and hidden text saying what it leads to, and the legend names the three.
- c623d60: Types as modules: a type is a folder `types/<slug>/` holding `type.yaml`, `messages/<language>.json`, `template.md` and optionally `schema.json` and `components/`, published by `type-module.schema.json`; the core types are such modules under `packages/profile/types/`, the default profile is assembled from them, and `resolveProfile` merges the modules a caller reads (`readTypeModules`) before the project profile, which may name a folder of modules under `types_dir`. A plugin contributes modules through the new `types` contribution point (registered in declared order, two plugins bringing one slug being a configuration error); the build and the render merge the modules of the plugins and of `types_dir` before the project profile, the global lint reads `types_dir`, and `concordance init --templates` also copies the templates of the types the declared plugins contribute. The entity page exposes the declaration of its type, labels every attribute as the profile does and lists the undeclared ones in an "other attributes" panel; a theme (`components`) or a type module (`components/`) provides `EntityPage@<type>`, `Attribute@<name>` and `Section@<key>` components, resolved theme first, then module, then default; and the gallery renders every registered type from its template, through its dedicated component when one exists.
- 1a5f84d: Validate the configuration before any processing: `concordance validate-config` reports every problem with its path, the value received and the values expected; `concordance init` writes a minimal valid configuration; `concordance build` stops on an invalid configuration.
- c54d224: White-label theme: `loadTheme` reads and validates `theme.yaml` (name, inline SVG logo, favicon, palettes, fonts, radius, footer with an optional credit replacing `mention_tool`, project stylesheet in the `project` layer, assets folder), a mode switch island remembers the reader's colour scheme, and the gallery renders the project's or a plugin's theme file.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- Updated dependencies [203133d]
- Updated dependencies [4b64d2a]
- Updated dependencies [03aab67]
- Updated dependencies [a0e7d01]
- Updated dependencies [378a546]
- Updated dependencies [d910b38]
- Updated dependencies [79c8264]
- Updated dependencies [58aa2a7]
- Updated dependencies [b64b730]
- Updated dependencies [415d998]
- Updated dependencies [c9a8fbc]
- Updated dependencies [1acb366]
- Updated dependencies [42b97f5]
- Updated dependencies [ce3bc7c]
- Updated dependencies [0591795]
- Updated dependencies [4463832]
- Updated dependencies [b6db21f]
- Updated dependencies [24a33f7]
- Updated dependencies [f900830]
- Updated dependencies [2d7b65d]
- Updated dependencies [7d514b3]
- Updated dependencies [e298d7d]
- Updated dependencies [1f18480]
- Updated dependencies [644998a]
- Updated dependencies [af10923]
- Updated dependencies [b5f0071]
- Updated dependencies [728ca5d]
- Updated dependencies [35aff55]
- Updated dependencies [116aca4]
- Updated dependencies [050d8a7]
- Updated dependencies [b17e66c]
- Updated dependencies [69cf231]
- Updated dependencies [ee71a72]
- Updated dependencies [21293ea]
- Updated dependencies [75add70]
- Updated dependencies [c1e8b5b]
- Updated dependencies [327897e]
- Updated dependencies [e20e743]
- Updated dependencies [1240f74]
- Updated dependencies [4bf8607]
- Updated dependencies [4154f49]
- Updated dependencies [05c0187]
- Updated dependencies [a1c0353]
- Updated dependencies [d833eda]
- Updated dependencies [1bbfecc]
- Updated dependencies [b9e4031]
- Updated dependencies [d5dc4b0]
- Updated dependencies [34c5a53]
- Updated dependencies [4bd6bd7]
- Updated dependencies [129f2ff]
- Updated dependencies [7cf3db8]
- Updated dependencies [82c5369]
- Updated dependencies [2bd083e]
- Updated dependencies [628625e]
- Updated dependencies [b092a63]
- Updated dependencies [20932a8]
- Updated dependencies [8ca9305]
- Updated dependencies [363d7d7]
- Updated dependencies [3fb3d96]
- Updated dependencies [cfc0835]
- Updated dependencies [3ae5687]
- Updated dependencies [77c55e5]
- Updated dependencies [efb8c03]
- Updated dependencies [17b4c5e]
- Updated dependencies [4f7f781]
- Updated dependencies [07c9269]
- Updated dependencies [3e254f0]
- Updated dependencies [2fe703f]
- Updated dependencies [5f8e108]
- Updated dependencies [32465c6]
- Updated dependencies [f34c511]
- Updated dependencies [3e9cf59]
- Updated dependencies [c55e31a]
- Updated dependencies [38a63c6]
- Updated dependencies [c290f2b]
- Updated dependencies [de7f8a2]
- Updated dependencies [64664a4]
- Updated dependencies [d0c0bc5]
- Updated dependencies [ef6d6fe]
- Updated dependencies [2f42c00]
- Updated dependencies [d4567f3]
- Updated dependencies [66d7b33]
- Updated dependencies [ce3f837]
- Updated dependencies [676a36a]
- Updated dependencies [c995c47]
- Updated dependencies [a5ef5ff]
- Updated dependencies [7bbb659]
- Updated dependencies [22ee8ab]
- Updated dependencies [a4db0b7]
- Updated dependencies [84a3d54]
- Updated dependencies [2922261]
- Updated dependencies [91c3305]
- Updated dependencies [cc77d53]
- Updated dependencies [3fca4dd]
- Updated dependencies [f6dea3f]
- Updated dependencies [ebfc39a]
- Updated dependencies [23617d8]
- Updated dependencies [c1a7b41]
- Updated dependencies [ecbb36a]
- Updated dependencies [f5cb89e]
- Updated dependencies [c5048be]
- Updated dependencies [a814a6e]
- Updated dependencies [cc3beed]
- Updated dependencies [55a794d]
- Updated dependencies [af5cdd2]
- Updated dependencies [cbe8fcd]
- Updated dependencies [b9e31e2]
- Updated dependencies [a954edf]
- Updated dependencies [0ef98c5]
- Updated dependencies [a4b7994]
- Updated dependencies [14088cd]
- Updated dependencies [c623d60]
- Updated dependencies [1a5f84d]
- Updated dependencies [c1a3598]
- Updated dependencies [c54d224]
- Updated dependencies [223a319]
  - @concordance-wiki/core@0.1.0
  - @concordance-wiki/site@0.1.0
  - @concordance-wiki/inference@0.1.0
  - @concordance-wiki/profile@0.1.0
  - @concordance-wiki/checks@0.1.0
  - @concordance-wiki/ingest@0.1.0
  - @concordance-wiki/nlp@0.1.0
  - @concordance-wiki/typing@0.1.0
  - @concordance-wiki/lint@0.1.0
