# The command line

`concordance` (alias `conc`) is one executable with seven commands. This page says what each one reads, writes and returns; the [getting-started guide](getting-started.md) walks through them once, the [configuration guide](configuration.md) explains the keys they read. Every command exits with 0 when it did its job, 1 when the configuration, the profile, the theme or the findings refuse it, 2 when it could not run at all.

```
usage: concordance <command> [options]

commands:
  build [--config file] [--output dir]  validate the configuration, build the model and render the site
  export [--format cypher] [--model dist/model.json] [--output file]
                                        turn the model into a Cypher script (stdout by default)
  gallery [--output dir] [--theme plugin] [--config file]
                                        render every slot with fixture data through the theme
  init [directory] [--templates]        write a minimal configuration file, and the note templates
  lint [--scope repo|global] [--source name] [--config file] [--fail-on error|warning|info]
       [--format text|json|sarif|junit] [--output file]
                                        check the current repository alone, or against the published model
  render [--model dist/model.json] [--output dir] [--config file]
                                        render the site again from an existing model, without the sources
  validate-config [--config file]       check the configuration and report its errors

exit codes: 0 ok, 1 invalid configuration or findings, 2 execution error
```

## `init`

```bash
concordance init            # writes concordance.yaml in the current folder
concordance init my-wiki --templates
```

Writes a minimal, commented `concordance.yaml` in the folder given (the current one by default) and refuses to overwrite one that exists (exit code 2; without `--templates` nothing is written then). `--templates` also copies the [note templates](../templates/README.md) under `templates/`: one per core type, then the template of every type contributed by the plugins declared in the `concordance.yaml` of the folder, the plugins being loaded for that (a plugin that cannot be loaded, or a type module that does not validate, stops the command); a template that already exists is kept and reported, the exit code being 2 whenever a file was kept. The written configuration declares one local source, `./notes`, so that a first build works on a folder of markdown files before any repository is declared.

## `validate-config`

```bash
concordance validate-config
concordance validate-config --config ../wiki/concordance.yaml
```

Checks the file against the published [`config.schema.json`](../reference/configuration.md) and prints one line per problem: the path of the faulty key, the value received, the values expected. Beyond the schema, it rejects a source name used twice, a malformed domain glob and pseudonymisation enabled without a dictionary, and it warns about keys that are accepted but ignored in this version (`lock`, tracker sources) and about transcripts published without pseudonymisation. Exit codes: 0 valid, 1 invalid, 2 file not found. `--config` (or `-c`) points at another file; the default is `concordance.yaml` in the current directory.

## `build`

```bash
concordance build
concordance build --config wiki/concordance.yaml --output public
```

`build` runs the validation of `validate-config` as its first step and stops there when it fails, then loads the profile (the default one, merged with `profile` when the configuration names one; an invalid profile stops the build the same way), loads the plugins declared under `plugins:`, fetches every source into `.concordance-cache/sources/` (depth 1, updated on the next build) without ever writing into a source, and runs the inference chain described in the [architecture guide](architecture.md#the-build-pipeline): it parses every markdown file, types the notes, lets the source plugins import the contracts the API notes declare, builds the recognition dictionary of every locale, scans every note for the titles and aliases it holds, produces the links (written links, frontmatter references, mentions in sections and prose, co-occurrence), combines their confidences, discovers the recurring expressions without a note and publishes the keyword pages above the threshold, reconciles the notes that look like twin resources, runs the model checks, and writes `dist/model.json`, the [canonical model](architecture.md#canonical-model), with `dist/build.log.json` and one fragment per entity under `dist/fragments/`; then it renders the site from those files alone, as `concordance render` does. A source it cannot reach is reported and skipped; see [private repositories](configuration.md#private-repositories) for credentials.

The summary at the end reports entities per type, links per method, keyword pages generated and expressions under the threshold, the twin-resource statistics, and findings per severity and per check, then what the rendering wrote: the number of pages, the number of former keyword addresses forwarding to a note, the size of each island bundle, the largest page against the 150 kB budget, the accessibility findings, the palette pairs under the contrast minimum, and the weight of the search index with its number of shards (`search index: 127.9 kB in 155 shards`).

### The site

`dist/` holds the whole site once the build ends. Open `dist/index.html` in a browser: no server is needed, every link is relative and every page sits in its own folder as `index.html`, so the site reads over `file://` as it does behind a server, without any URL rewriting.

| Path | What it is |
|---|---|
| `index.html` | the home page: the question "What are you looking for?" and its explanation, the search field drawn large, submitting to the results page and showing its live results under it as you type (the title with the query marked, the type or "Used in N documents, never defined" for a word without a note, the space, the number of matches, the keyboard help and the link to the whole list), the twelve most cited pages as shortcuts (a note by the links pointing at it, a keyword page by its occurrences), then the spaces, one row per source, most cited first, with its initials, its page or document count and the date of its newest change from the git history, each row leading to the page of its space, the spaces past the fifth folded behind "N more spaces, less cited", the eight latest changes with their space and date, and an alert for every source whose newest change is older than `staleness.warn_after_days` (180 days by default), naming the threshold; the letters live on the index page and the to-do link in the footer; no dashboard, no metric, no chart |
| `<id>/index.html` | one page per entity, at the address of its identifier (`glossary/keyword-page/index.html`), in three regions: on the left the tree of its space (the source it comes from, with its initials, its folders and their page counts, the folder of the page open and the page marked); in the centre the breadcrumb (space › folder › page), the title, a line naming the type, when the note last changed and the space, with the highlighted properties the profile names (two on that line, five at most), then the note rendered to HTML at full width, section by section, its written links and recognised words marked and explained by a legend, and under it the path of the file (`glossary/keyword-page.md`) with "Something to correct? Edit this page" leading to the forge when the source is a GitHub or GitLab repository or `project.edit_url` is set; on the right three blocks, the declared properties, the table of contents of the note, and the related pages (every page that evokes the entity, most passages first, with its type, its count and an excerpt, "Cited" when it writes a link), then the line that unfolds the neighbourhood map, which from the desktop width replaces the blocks of the panel by the map under a back control: the distance the model records, a type filter of checkboxes, the map framed with its legend, the neighbours as a list with their types and counts and the note on why the map stops at six; on a phone the bar keeps the mark, the name and a menu button opening a drawer (the search field, the spaces with their page counts, the tree of the space, the index and the recent changes), the breadcrumb keeps the last folder and the page, and the panel follows the text as folded blocks, the related pages open; on a tablet the panel stays beside the text, condensed, and the map moves to the foot of the page; a keyword page shows, on the same shell, the tree of the glossary with the word at its place, the breadcrumb "glossary › Terms › word", the dotted title with the "No definition" mark and "Used since <month year>" when a citing file carries a git date, a notice saying that nobody wrote a definition with the number of passages and the button "Propose a definition" leading to the forge of the glossary, then the passages grouped by file in corpus order with the type and the title of each file, each passage at its timecode, its page or its line with the expression marked; on the right what we know (occurrences, files, spaces), the expressions that may be the same thing, the accompanying words sized by co-occurrence, and the related pages with the note that none is cited; a meeting shows, on the same shell, the tree of its space by year and month when every note of the space is dated, the breadcrumb "space › March 2026 › title", the line "Meeting · 1 h 12 · Pseudonymised participants" (the duration from the `duration` attribute or the last cue of the transcript, the mention when `privacy.pseudonymize.enabled` is set, else the number of participants), its representations as tabs that work without JavaScript, "Transcript | Notes | Slides", with the mention "Grouped automatically" when the build merged the files, the transcript as timestamped lines "12:04 Participant-1 — …" each timecode an anchor, the note that the names are replaced by stable pseudonyms and the mapping never published, the callout "Decision taken here" linking the decisions the model ties to the meeting; on the right the date, the duration, the space and the grouped files with why the build grouped them, then the related pages with the note that a meeting does not enter the model. The images a note embeds from its repository sit next to the page, under `<id>/` |
| `<id>/index.html` | one page per entity, at the address of its identifier (`glossary/keyword-page/index.html`), in three regions: on the left the tree of its space (the source it comes from, with its initials, its folders and their page counts, the folder of the page open and the page marked); in the centre the breadcrumb (space › folder › page), the title, a line naming the type, when the note last changed and the space, with the highlighted properties the profile names (two on that line, five at most), then the note rendered to HTML at full width, section by section, its written links and recognised words marked and explained by a legend, and under it the path of the file (`glossary/keyword-page.md`) with "Something to correct? Edit this page" leading to the forge when the source is a GitHub or GitLab repository or `project.edit_url` is set; on the right three blocks, the declared properties, the table of contents of the note, and the related pages (every page that evokes the entity, most passages first, with its type, its count and an excerpt, "Cited" when it writes a link), then the line that unfolds the neighbourhood map, which from the desktop width replaces the blocks of the panel by the map under a back control: the distance the model records, a type filter of checkboxes, the map framed with its legend, the neighbours as a list with their types and counts and the note on why the map stops at six; on a phone the bar keeps the mark, the name and a menu button opening a drawer (the search field, the spaces with their page counts, the tree of the space, the index and the recent changes), the breadcrumb keeps the last folder and the page, and the panel follows the text as folded blocks, the related pages open; on a tablet the panel stays beside the text, condensed, and the map moves to the foot of the page; a keyword page shows, on the same shell, the tree of the glossary with the word at its place, the breadcrumb "glossary › Terms › word", the dotted title with the "No definition" mark and "Used since <month year>" when a citing file carries a git date, a notice saying that nobody wrote a definition with the number of passages and the button "Propose a definition" leading to the forge of the glossary, then the passages grouped by file in corpus order with the type and the title of each file, each passage at its timecode, its page or its line with the expression marked; on the right what we know (occurrences, files, spaces), the expressions that may be the same thing, the accompanying words sized by co-occurrence, and the related pages with the note that none is cited; the page of an API whose contract was imported shows, on the same shell, its operations under it in the tree, no highlight under the title, then after the note the operations table matched to the contract by operation name (the method as a chip, the path, the title of the operation note linked, how many pages cite it, the gaps in italics: an operation the contract declares without a page, a note the contract does not declare) and the contract block (its format, its file, when it was imported, the download link, the viewer behind its button and the note that no schema is copied into the text), the properties cut to five keys and the operations first among the related pages. The images a note embeds from its repository sit next to the page, under `<id>/` |
| `keywords/<slug>/index.html` | the page of a recurring expression no note defines; when a note defines the expression, the same address forwards to the note's page, so that a link to it survives the note |
| `index/index.html` | the A–Z index of every word the documentation uses, ordered by the collation of the project locale (its language pack: accents and case set aside, digits compared by value): the sentence counting the words and those with a written page, the "Filters" button folding links to the results page filtered by type, by space or to the words without a definition, a bar of letters, a letter without an entry visibly inactive and struck through, "N letters without an entry", then for every letter its heading with its count and a table of the words with their type, the first line of their page (the summary of the note) and the number of pages citing them; a word without a definition is dotted, marked "no definition" and described by the passage of the file that uses it most, quoted with the title of that file, and the note under the table says so; when the whole index rendered as one page would weigh more than 100 kB, every letter with entries gets its own page (`index/a/index.html`, `index/other/index.html` for titles opening with a digit or a symbol) and `index/index.html` shows the first of them, so that every index page stays under the budget |
| `todo/index.html` | the to-do page, two lists and nothing else: the documents without a markdown representation (the entities the `W-DOC-NOMD` findings name, with their number of files) and the words above the threshold without a note (the keyword pages, with their occurrences and the files they spread over), each entry leading to the page concerned, most occurrences or files first then by identifier; the footer of every page and the home page link to it with the total of both lists, the top bar carrying no statistic; no other finding appears there, the linter plays that role |
| `search/index.html` | the results page, filled by the search island from the `q` parameter of its address: the facets in the left column, the active filters as chips and the rows as cards with the type, the title, the citations, the summary and the declared names; the search field of every page submits to it |
| `spaces/index.html` | the spaces page: "N spaces, fed by the repositories declared in the configuration…", then one table with every space in the order of the home page, the most cited first, none folded: its initials and its name, its content (`sources[].description`, else the labels of its dominant types), its page count and its newest change from the git history; a space past `staleness.warn_after_days` reads its date in the accent and in days, "193 days ago", the only place where a colour carries an alert; the note under the table says so and names the default threshold |
| `<source>/index.html` | the page of one space, where the rows of the home page, the "Spaces" link of the bar, the drawer and the breadcrumbs lead: the breadcrumb "Spaces › name", the initials badge, the title, the description of the configuration when there is one, "N pages · repository X · updated N days ago" (the repository named from the URL of a git source, else by the source name); "Browse — N categories, as filed in the repository", one card per top-level folder of the repository with its count, each opening the list of the category, or the page the tree lists first under the folder when a note takes the address of the list; "Recently changed", the four latest pages of the space with their category; "The most cited words here", the five pages the notes of the space cite most, counted in the space only, a word without a note dashed; and the sentence "A space reads like a small wiki within the wiki: its own search, its own vocabulary, its own news." The search field of the bar reads "Search in this space" and submits with the space as the source facet, its live results keeping to the space; no tree on the page |
| `<source>/<folder>/index.html` | the list of a category: one page per folder at the top of a space, at the folder's address, unless a note takes it; on the left the tree of the space with its folders and their counts, this one marked; in the centre the breadcrumb (Spaces › space › folder, the first step leading to the spaces page and the second to the page of the space), the title (the folder name, capitalised), a line counting the notes as the type of the folder words it and describing that type in one sentence from the profile ("64 screens described. A screen is a page of the application, with what it shows and what it allows."; "64 pages." for a folder whose notes have several types), two selectors (the first attribute the type highlights, its values filtering the list, and the sort, by title or by number of related pages), the table of notes with the title, the values of that attribute, the first line of the note and the number of related pages, then the rows shown of the whole ("8 screens of 64 — pagination by twenty.") with the page links and the note on the links column; the search field of the page asks to search in the category and submits with its space and type; the selectors link to pages pre-rendered under `<source>/<folder>/-/` (`-/links/`, `-/roles-reader/`, `-/page-2/`) while the sorts times the values give twelve pages at most, and are applied in place by an island beyond, the page reading by title without JavaScript |
| `search/meta.js`, `search/<prefix>.js` | the search index: the entity table and one shard per two-character prefix, loaded by the page as the reader types; see [Search](#search) |
| `<id>/<path of the file>` | the original file of a document (a deck, a PDF, a transcript) next to its page, for the download link, and its PDF when the conversion produced one and the source keeps previews |
| `assets/` | `site.css`, the fonts of the default theme under `fonts/` (Instrument Sans and IBM Plex Mono as woff2, with their licence), the project stylesheet when `theme.yaml` names one, the island bundles named after their content, the pdf.js viewer and its worker when the site shows a PDF, and the favicon and logo of the theme |
| `model.json`, `build.log.json`, `fragments/` | what the build wrote for the rendering, kept next to the site; see below |

The URL of a page follows the identifier of its entity and nothing else, so it stays the same from one build to the next as long as the identifier does. The main content of every page is in the served HTML: the text of the note, the section headings, the tree of the space, the neighbours and the related pages of the first mentions read without JavaScript, which only adds the mode switch, the trail, the filters and the other related pages, and the search. The tree and the blocks of the right panel are native disclosures, folded on a narrow screen and open where the page has room, so that the site reads on a phone as on a desk. The top bar of every page carries the mark and the name of the site, the search field (press `/` to reach it), the links to the spaces page, the A–Z index and the recent changes, and the light and dark toggle. The page of a document adds its download link, a rail of its pages, slides or cues and their extracted text, all in the HTML, and a button that loads the pdf.js viewer on demand when the document has a PDF. The page of an office document, a deck or a report, alone or merged with its note, opens on the document instead: the tree of its space folded by year and month when every page of the space is dated, the line naming the kind, the page count, the size and the date read from the file, the tabs "Document", "Extracted text" and "Related notes" as anchors that work without any script, "Download the original", the strip of numbered pages beside the rendering of the current page (the viewer as soon as its script runs, the browser's own PDF viewer without it), and in the panel the properties read from the file, the files that make the document, the related pages and the neighbourhood.

#### Keep a trail

Under the header, the trail lists the pages you visited, in order, each a link. It travels in the URL as `#trail=glossary%2Fsource,glossary%2Fnote,…`, so copying the address of the page shares the path you followed and reloading restores it; following a link of the site carries it along. Press "Pin" to keep the trail in the browser between visits: the next visit starts from it, every page you then open joins it, and "Unpin" forgets it. Beyond twelve pages the oldest fold into one "… N earlier pages" entry that opens on demand. Nothing is fetched and nothing leaves the browser: the trail works over `file://` as it does behind a server, and without JavaScript it simply is not there. The [theming guide](theming.md#trail) describes the island, the URL format and the storage key.

### Search

The field in the header of every page searches the whole site as you type, without a server: the build writes an index under `dist/search/`, and the page loads it in pieces. Press `/` anywhere on a page to reach the field, `Escape` to leave it; the best results appear under the field, each a link with its title, the query marked in it, its type or the notice that no note defines the expression, and its space; `↓` walks down the rows and `↑` back up to the field, `Enter` opens the row in focus, and the last line leads to the results page, `search/index.html?q=…`, with the whole list, which follows the field too. The field at the head of the home page is the same field drawn large, its results in the flow of the page with the number of matches next to it; `/` reaches it first there. Both fields show the query with a ✕ that clears it, in place of the `/` hint in the header while the field holds something.

A query matches by prefix: `key` finds "Keyword page", `checks` and `check` both find a note about checks, and there is no typo correction. Every word of the query must match. The fields indexed are the title (weight 5), the aliases (4), the summary, the first paragraph of the note or its `summary` frontmatter key (2), the body of the note (1), and the type, application, domain, status and source (1 each); the score of a result is the sum of the weights of the fields each word matched, and among results of the same score the most cited comes first, the pages citing an entity being the distinct sources of the links pointing at it, then the order of the model. The body of a note is indexed up to `build.extracted_text_max_chars` characters, 20 000 by default; the text extracted from converted documents will enter the same field when conversion exists.

The results page narrows the list with four facets, drawn as checkbox groups in the left column with the count of every value: "Page type" and "Space" (the type and the source) open, "Domain", "Application" and "Without a note" folded under them, with the note that the counters are set when the site is published and that the filtering happens in the browser, without a round trip. The values come from the entity table the build wrote, and the counts are computed in the browser over the results of the current query, so that nothing is fetched beyond the shards of the words typed. Facets combine: selecting a type and a source keeps the entities carrying both, and two values of the same facet keep the entities carrying either. A value nothing would come of under the current filters stays listed, at 0, its box disabled, rather than vanishing. The count of a value is what selecting it would keep, so a second value of the same facet always shows what it adds. The selected values are recalled above the results as chips, each a link with a ✕ that lifts it, next to a link that clears them all. Without a query, the page lists every entity of the site under the facets, the most cited first, with the counts of the whole table, which the build writes in `search/meta.js`. The summary reads "218 results, most cited first" in the site language and never a time: a static site has no server to time, and the search runs in the browser on files already loaded. Each row gives the type as a chip, the title, "cited in 64 pages", the summary (the first paragraph cut at two hundred characters when the note declares none), then its space, its other names ("Also called: word page") and its broader term when the note declares them. When nothing matches, the page names the query and proposes the closest form of the dictionary, the title or alias sharing the longest prefix with the query, with its citations or its occurrences, as a link to the search on it.

The state of a search is its address: `search/index.html?q=versement&type=term,screen&source=specs&domain=quality&application=concordance-cli`, the query under `q` and the selected values of every facet under its name, separated by commas. A facet followed pushes an entry to the history; typing rewrites the current entry once the reader pauses for 300 ms, so that the back button steps over the facets, not over every keystroke; the back and forward buttons replay the state of the address, the field, the facets and the list included. Opening the address restores the query, the filters and, on a page the reader already left, the scroll position, which the page remembers per address in the session storage of the browser. The address is written under the summary, from the root of the site, so that the state is explicit and can be sent as it is; a "Copy" button next to it, shown when the browser exposes a clipboard, which most refuse over `file://`, copies the whole address and says so.

The recurring expressions nobody defined, the words the [keyword pages](#the-site) stand for, appear among the results like any entity, in a dashed card with a dashed chip and a dotted title that states under the title "Used in 6 documents, never defined in the glossary", from the counts the build wrote in the table; a note under the list says that the words used but not defined appear with the others, dotted, which is how a gap of the glossary shows. A fifth facet, "Without a note", keeps them among the results (the default), keeps them alone or leaves them out; its choice travels in the address as `nonote=only` or `nonote=exclude`. A keyword page never comes before an entity of the same score: at equal relevance the entities go first, then the keyword pages, each in the order of the model, so that a gap of the glossary shows next to the notes without pushing one down.

The index is a set of classic scripts, not JSON files fetched over HTTP, so that the search works when `dist/index.html` is opened from the disk: browsers refuse `fetch` from a `file://` page, and some refuse module scripts there, but all load a plain `<script src>`; every island of a page is a classic script for the same reason. `search/meta.js` holds the entity table (identifier, title, type, URL, application, domain, status, source, the summary cut at two hundred characters, the aliases, the broader term and the number of citing pages, with the labels the results show, the counts of every facet value over the whole table, and the strings of the results page in the site language); `search/<prefix>.js` holds the tokens starting with two given characters and the entities carrying each, with their weight. The page loads the table when the field takes focus and one shard per word typed, once. On the realistic corpus of the fixtures, the whole index weighs about 165 kB in 155 shards, the largest shard under 4 kB and the table about 100 kB.

### Findings and exit codes

A content anomaly never stops the build: a file that is not UTF-8, a broken frontmatter or an unreachable source becomes a finding with an identifier, a severity, the file and line, a message and a remediation (see the [check pages](../checks/README.md)). Every finding is printed on stderr, and the summary on stdout counts sources, files, findings per severity and per check. The findings and the summary are written to `dist/build.log.json` (the folder is `--output`, else `build.output`, else `dist/` next to the configuration); the same `findings` array is embedded in `model.json`. The only timestamp in the log is its `at` field.

Whether the build fails is decided by `build.fail_on` alone: by default it fails when any error finding exists and when more than ten documents could not be converted (`fail_on.errors`, `fail_on.unconverted_max`, see the [configuration guide](configuration.md#build)). Exit codes: 0 when the build succeeds, 1 when the configuration or the profile is invalid or the findings exceed `build.fail_on`, 2 on an execution error (a plugin that cannot be loaded, a missing stopword file). The log, the model, the fragments and the site are written before the verdict, so a failing build still leaves them for inspection.

### Reproducible builds

Two builds of unchanged sources write byte-identical files, so that `dist/` can be committed and diffed. Every list is written in a canonical order and nothing in the outputs depends on the clock, except the `at` field of the build log and of the `build` block of `model.json`. To pin that field too, set `SOURCE_DATE_EPOCH` to a number of seconds since the epoch, as reproducible-builds tooling does:

```bash
SOURCE_DATE_EPOCH=0 concordance build --output first
SOURCE_DATE_EPOCH=0 concordance build --output second
diff -r first second
```

The repository verifies this on every change: the golden corpora are built twice and every file under the two output folders is compared.

## `render`

```bash
concordance render
```

`render` reads `dist/model.json` and the fragments next to it, and writes the site again under the same folder: after a change of `theme.yaml`, of the labels, or of the tool itself, the pages are rebuilt without cloning a source or running the inference chain. `--model` names another model file (its fragments are read from the folder holding it), `--output` another folder, `--config` another configuration; the configuration and the profile are read as the build reads them, for the site title, the locale, the plugins that bring a theme and the labels of the types. The command exits 0 when the site is written, 1 when the configuration, the profile, the theme or the model is invalid, 2 when the configuration or the model file is missing. A page over the budget or with an accessibility finding is a warning on stderr and in the summary, never a failure.

The fragments are what lets the rendering forget the sources. The build writes `dist/fragments/<id>.json` for every entity: the note rendered to sanitised HTML, one section per heading with its identifier, its heading and its HTML, the written links already turned into page hrefs and marked `written`, every word the occurrence scan recognised wrapped in a `recognised` link to its page; the list of the images the note embeds from the sources, whose bytes the build keeps under `dist/fragments/<id>/…` and `render` places next to the page; the plain text of the note, which the search index reads; for a keyword page, the passages where the expression was read, with their source, file, line, the expression as written and its context, and the pages of a similar form offered as leads; for a note, the keyword addresses it took over. `render` reads them by identifier and renders an entity without one with no note text, with a warning that counts them.

## `export`

```bash
concordance export --format cypher --output graph.cypher
```

`export` reads `dist/model.json` (`--model` names another file), validates it against the published schema, and writes a Cypher script: one `MERGE` per entity with its properties, one per link with its confidence and methods. Without `--output` the script goes to stdout, so `concordance export | cypher-shell` loads the graph directly. Exit codes: 0 written, 1 when the model does not match the schema, 2 when the file is missing or the format is not `cypher`, the only one in this version.

## `lint`

Each source can check itself before pushing, without the global build. From the root of the repository:

```bash
npx concordance lint
```

The command reads every markdown file under the current directory, one file at a time, and prints one line per finding, sorted by check, path and line, then a count:

```
error: screens/entity-page.md:3: E-LINK-BROKEN: link "threshold.md" in screens/entity-page.md points to no file of source repo (https://github.com/concordance-wiki/concordance/blob/main/docs/checks/E-LINK-BROKEN.md)
1 finding: 1 error, 0 warnings, 0 info
```

Options:

| Option | Default | Effect |
|---|---|---|
| `--scope repo\|global` | `repo` | `repo` checks the current repository alone; `global` also checks it against the published model of the wiki; see [Global scope](#global-scope) |
| `--source <name>` | none | names the source this repository is declared as, so that its rules apply: the type suffixes of its `rules` are stripped from identifiers; without `--config`, the name only prefixes the identifiers |
| `--config <file>` | none | the `concordance.yaml` that declares the source; its `privacy.exclude` and `checks` blocks apply |
| `--fail-on error\|warning\|info` | `error` | the severity from which a finding makes the command fail |
| `--format text\|json\|sarif\|junit` | `text` | the shape of the report; see [Reports for forges](#reports-for-forges) |
| `--output <file>` | none | writes the report to that file instead of standard output; the only file the command ever writes |
| `--fix` | | applies the safe corrections before the check, after printing each of them; see [Safe fixes](#safe-fixes) |
| `--dry-run` | | lists the corrections `--fix` would apply, prefixed with `would fix`, and writes nothing; implies `--fix` |

What is checked in this version: UTF-8 encoding (`E-ENCODING`), YAML frontmatter (`E-FM-INVALID`), frontmatter identifiers (`E-ID-INVALID`), unique identifiers with the source's suffixes stripped (`E-ID-DUP`) and internal links (`E-LINK-BROKEN`). A link with a `source:` prefix or one that climbs above the repository targets another source and is left to the [global scope](#global-scope). The type cascade and the checks that depend on it (`E-TYPE-CONFLICT`, section headings) join the local lint with the typing package. Without `--source`, the repository is the source named `repo`: that name prefixes the identifiers and appears in the messages.

### Parity with the build

The local lint says the same thing as the build. For the five checks above, `concordance lint` on a repository and `concordance build` on a configuration that declares it as a source produce the same findings: same check, source, path, line and entity, same severity, message and remediation. The build reports more, never less: the checks that need the whole model (types, filing, cross-source links, vocabulary) only exist there. A finding fixed because the linter reported it never comes back in the pipeline under another wording.

The list of the local checks is exported as `LOCAL_CHECKS` by `@concordance-wiki/lint`, and the JSON report repeats it (see [Reports for forges](#reports-for-forges)). The repository holds the guarantee with a parity test that runs the linter, source by source, and the build on a copy of each fixture corpus, the golden ones and the faulty ones, and compares the findings of the local checks one by one; any divergence fails continuous integration.

In this mode the command never opens a network connection, and it writes nothing but the report named by `--output` and, under `--fix`, the corrected files. A `concordance-lint.yaml` at the root of the repository overrides severities locally; see the [configuration guide](configuration.md#concordance-lintyaml).

Exit codes, whatever the format: 0 when no finding reaches the `--fail-on` severity, 1 when one does, 2 when the lint could not run (unknown option, scope or format, missing or invalid configuration, unknown source, faulty `concordance-lint.yaml`).

### Global scope

A note that links to another repository, references an entity of it in its frontmatter, or reuses a title the glossary already carries, cannot be checked from where it is written. `--scope global` reads the last published `model.json` of the wiki and checks the local notes against its entities, without rebuilding anything:

```bash
npx concordance lint --scope global --source specs
```

The model comes from `global.model` in `concordance-lint.yaml`, a URL or a path (see the [configuration guide](configuration.md#concordance-lintyaml)); the local checks run as well, and the report holds both, deduplicated on check, file, line and entity. Three checks run over the local notes and the remote entities, each finding naming the remote entity and the build timestamp of the model it read:

| Check | What is compared |
|---|---|
| `E-LINK-BROKEN` | a markdown link with a `<source>:` prefix, or a relative path that climbs above the repository into `../<source>/…`, must reach a note the model knows in that source; a target that is not a markdown file, an unknown prefix or a URL is left alone |
| `W-LINK-CROSS-SOURCE` | such a link reaches a note, but the model was built with `inference.cross_source_links` off, so the build will not record it; the model says how it was built in its `build.cross_source_links` field, and a model without that field skips this check |
| `E-META-REL` | every frontmatter key of the note's type that declares a relation (`reads`, `roles`, `applies_to`, `covers`…) is resolved against the remote entities, and the pair of types must be one the profile allows for that relation; `inverse` keys are read the other way round; the default profile applies unless `global.profile` names a project profile |
| `I-TERM-HOMONYM` | the title or an alias of a local note, compared in the language of the source, is also the title or an alias of a remote entity of another type |

The remote model is cached under `global.cache_dir` (`.concordance-cache/lint` by default) and reused without any request for `global.max_age_hours` (24 by default); past that, it is fetched again with the validators the server gave (`ETag`, `Last-Modified`), and a `304 Not Modified` renews the copy. The cache is the only thing this scope writes.

When no model can be read (no `global.model`, no network, a non-2xx response, a file that is not a valid model, an unreadable project profile), the command prints one line on standard error, `global: <reason>; local checks only`, runs the local scope alone and exits according to the local findings; the JSON report then carries `scope: "global"`, `degraded: true` and the `reason`, with `checks` reduced to the local checks that ran, and the SARIF log the same three keys under the run's `properties`. A cache past its validity is still used when the refresh fails, and the line then says how old it is.

### Safe fixes

`--fix` corrects what is mechanical and certain, then runs the check on the corrected files. Every correction is printed as `fix: <path>:<line>: <description>` before the first file is written, so that a log shows what changed:

```
fix: screens/entity-page.md:1: add the deduced "type: screen" to the frontmatter
fix: screens/entity-page.md:1: order the frontmatter keys: id, type, title, status
fix: screens/entity-page.md:7: rewrite link "threshold.rule.md" to "../rules/threshold.rule.md", the only file named threshold.rule.md
refused: screens/entity-page.md:9: link "threshold.md" matches several files: archive/threshold.md, glossary/threshold.md; choose one
```

Three corrections exist:

- the deduced type: when a note has a frontmatter block without `type` and the source given by `--source` and `--config` deduces one (`default_type`, then `type`, then the `rules` in order, the last match winning), `type: <deduced>` is added. A note without frontmatter is left alone, since its type already comes from where it is filed, and the implicit `document` default is never written;
- the key order: the frontmatter keys are written as `id`, `type`, `title`, `aliases`, `status`, then the rest alphabetically. Comments travel with their key. A frontmatter that is not valid YAML is left untouched: `E-FM-INVALID` reports it;
- a renamed target: a link to a missing file is pointed at the only file of the repository carrying the same name and extension, as a path relative to the note, the anchor kept. Only the destination characters between `](` and `)` are replaced.

The fixer refuses, and says so on a `refused:` line, when several files carry the name, or when the destination is written between angle brackets. It never adds a link, never removes one, never touches the body of a note, and never writes a relation the tool inferred: the diff of a fixed file only shows the frontmatter block and existing link destinations. A second `--fix` on a fixed repository changes nothing.

The linter uses the same checks as the build. See the [check pages](../checks/README.md) for what each finding means and how to fix it; every finding line ends with the URL of its page.

`npx` is one of six forms of the linter: a standalone binary, a GitHub action, a GitLab CI/CD component, the container image and a pre-commit hook run the same command line and produce the same report. [Distributing the linter](lint-distribution.md) gives a copyable example of each.

### Reports for forges

`--format` picks a machine-readable report so that a merge request shows the findings where they belong instead of in a pipeline log. Each report holds the whole run alone on standard output, without the summary line, and `--output <file>` writes it to a file instead; the findings are sorted the same way in every format, so two reports of the same tree are byte-identical.

| Format | Content | Use it for |
|---|---|---|
| `json` | `{ version: 1, tool, scope, checks, findings, summary }`; `scope` is `repo` or `global` and `checks` lists the identifiers of the checks the run covers, so that a report says what was checked: the `LOCAL_CHECKS` of the [parity guarantee](#parity-with-the-build) in the `repo` scope, those and the four checks of the [global scope](#global-scope), once each and sorted, in the `global` scope; a degraded global run adds `degraded: true` and the `reason` after `checks`, which then lists the local checks alone, since the global ones did not run; each finding carries its check, severity, source, path, line, entity, message, remediation and documentation URL; `summary` counts errors, warnings and info | scripts and dashboards |
| `sarif` | a SARIF 2.1.0 log with one run: one rule per check met (description, documentation URL, default level) and one result per finding pointing at the file relative to the repository (`%SRCROOT%`) and the line; `info` findings are `note` results | the code-scanning upload of GitHub, the SARIF viewers of editors |
| `junit` | one `concordance lint` test suite with one test case per finding, named `<check>` and `<path>:<line>`; errors and warnings fail their case, an info finding is only reported in its output; a clean repository gives one passing case named `no finding` | the test report of GitLab and of most pipeline runners |

```bash
npx concordance lint --format sarif --output concordance.sarif
npx concordance lint --format junit --output concordance-junit.xml
```

The [pipeline examples](pipelines.md#lint-in-a-merge-request) show how to upload the SARIF log to GitHub and the JUnit report to GitLab.

## `gallery`

```bash
concordance gallery --output reports/gallery
```

Renders every slot of the site with fixture view models into a static page set under the output folder (`./gallery` by default): an index listing the slots, their states and the plugin behind every override, one page per slot and state, the stylesheet and the island bundles under `assets/`. The theme comes from `--theme` (a package name or a module path, repeatable), else from the `plugins:` of the configuration when one is found, else the default theme. Every page is measured against the budget and checked for accessibility; the command exits 1 on a page over budget or with an accessibility finding, 2 when a theme cannot be loaded. It is the tool of theme authors; see the [theming guide](theming.md#gallery).
