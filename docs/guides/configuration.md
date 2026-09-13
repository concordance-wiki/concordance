# Configuration

Everything lives in a configuration repository: `concordance.yaml`, an optional `profile.yaml`, a `theme.yaml`, stopword files, `concordance.lock.yaml`, and, never versioned in a public repository, `pseudonyms.yaml`. `concordance validate-config` checks `concordance.yaml` against [`config.schema.json`](../../packages/core/schemas/config.schema.json) and prints the path of any faulty key, the value received and the values expected, then a verdict line. Exit codes: 0 valid, 1 invalid, 2 file not found. Beyond the schema, it rejects a source name used twice, a malformed domain glob and pseudonymisation enabled without a dictionary, and it warns about keys that are accepted but ignored in this version (`lock`, tracker sources) and about transcripts published without pseudonymisation. `--config` (or `-c`) points at another file; the default is `concordance.yaml` in the current directory.

The reference below follows the schema. Every key not marked required is optional.

## `version`

Required. Schema version, currently `1`.

## `project`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | displayed in the site |
| `locale` | BCP 47 tag | `en` | interface language and default source locale; see [`sources[].locale`](#sources) for what a locale selects |
| `theme` | path | `./theme.yaml` | theme file, relative to this configuration; the default is used when the file exists |
| `edit_url` | string | — | pattern for the "edit in the forge" link, with `{source}`, `{path}` and `{commit}` placeholders. Without it, a source whose `git` URL is an HTTPS URL of `github.com`, `gitlab.com` or a `gitlab.` host gets `<url>/edit/<ref>/<path>` or `<url>/-/edit/<ref>/<path>`, the `ref` being the source's or `main`; a local source gets no link |

## `profile`

Path to the project profile, merged over the default profile key by key. See [writing notes](writing-notes.md#profile) for what a profile can add.

## `plugins`

List of plugins to load, in order. Each entry is a package name or an object `{ name, options }`. The `concordance` preset loads every official plugin by default; list them explicitly to restrict or reorder.

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - name: "@concordance-wiki/plugin-convert-libreoffice"
    options: { timeout_s: 120 }
```

## `applications`

Containers of first level. Every entity is resolved to one, in increasing precedence: the source's `application`, a typing rule's `set: { application }` (the last matching rule wins), the note's frontmatter `application`. An entity without one yields `W-APP-MISSING`; an identifier that `applications:` does not declare is kept as written and yields `W-APP-UNKNOWN`. Applications and domains declared as notes are containers and are exempt from `W-APP-MISSING`.

```yaml
applications:
  - id: concordance-cli
    title: Concordance command line
    status: active   # active | legacy | target
```

## `domains`

Global business domains, orthogonal to sources. The globs of every domain are evaluated on the path of every file relative to its source root, whatever the source; a glob such as `**/*keyword*` therefore files `glossary/keyword-page.md` and `specs/screens/keyword-page.md` together. A subdomain's globs are evaluated on their own, after its parent's: the deepest matching domain wins, and between domains of the same depth the last declared. The entity records the full identifier path of its domain, `inference/recognition` below.

A frontmatter `domain` overrides the globs; it names a domain by its identifier (`recognition`, the first declared with it) or by its identifier path (`inference/recognition`). A value that names no declared domain is kept as written and yields `W-DOMAIN-UNKNOWN`. A note that no frontmatter and no glob files goes to the `unclassified` domain and yields `W-DOMAIN-UNCLASSIFIED`; applications and domains declared as notes are containers and are exempt.

```yaml
domains:
  - id: inference
    title: Inference
    match: ["**/inference/**", "**/links/**"]
    subdomains:
      - id: recognition
        match: ["**/recogni*/**", "**/dictionary/**"]
```

## `privacy`

| Key | Meaning |
|---|---|
| `exclude` | globs applied before any content is read |
| `pseudonymize.enabled` | replaces speaker names and detected personal mentions by stable pseudonyms; `false` by default |
| `pseudonymize.scope` | types concerned, `[meeting]` by default |
| `pseudonymize.dictionary` | path to `pseudonyms.yaml`, real name → pseudonym; never published |
| `pseudonymize.keep_roles` | keep the role instead of the pseudonym when known |
| `publish_transcripts` | `false` by default; transcripts are indexed only when explicitly requested |

### Pseudonymisation

When `pseudonymize.enabled` is `true`, every transcript is pseudonymised before anything else reads it: the rendered page, the search index and the model only ever see the pseudonymised form. Three things happen to a transcript.

- Every speaker named in the dictionary takes its pseudonym, or its role when `keep_roles` is `true` and the entry has one. A speaker the dictionary does not know becomes `Speaker-1`, `Speaker-2`… numbered by first appearance within that transcript, so that the numbering is stable as long as the transcript does not change; add the person to the dictionary for a pseudonym that survives an edit.
- Every occurrence of a real name of the dictionary inside the spoken text is replaced the same way, including the names of the numbered speakers. Names are matched on word boundaries, without regard to case or accents, longest name first: with both `Mary Ann` and `Mary Ann Smith` declared, "mary ann smith" becomes the pseudonym of the latter and "source" is never found inside "resource".
- A run of two or more capitalised words that no dictionary name covers, "Firstname Lastname" style, is reported as [`I-PII-DETECTED`](../checks/I-PII-DETECTED.md) for review and left as written. All-uppercase words are read as acronyms and never start a mention, and the heuristic knows nothing about sentences: a capitalised first word followed by a name is reported with the name.

`pseudonyms.yaml` is validated by [`pseudonyms.schema.json`](../../packages/core/schemas/pseudonyms.schema.json):

```yaml
version: 1
people:
  "Mary Ann Smith":
    pseudonym: Participant-1
    role: Project lead
  "Élodie Dupont":
    pseudonym: Participant-2
```

A dictionary that declares the same person twice, whatever the case and accents, or a name without a word, is refused with the path of the faulty entry. The dictionary is read at build time only: it is never copied into the output, and the publication tests walk the output for its real names. Keep it out of any public repository.

`publish_transcripts` is what makes transcripts part of the published site and of its search index; a build without it keeps them out, pseudonymised or not. `concordance validate-config` warns when it is `true` without `pseudonymize.enabled`, and reports an error when `pseudonymize.enabled` is `true` without a `dictionary`. Pseudonymisation is a technical mechanism, not an authorisation to publish: informing the participants, the legal basis and the retention period are governance decisions that the build cannot take. [Publishing transcripts](publishing-transcripts.md) sets out what to settle before the first build that publishes one.

## `sources`

One entry per repository or local folder. Names are unique.

| Key | Meaning |
|---|---|
| `name` | required, unique; first segment of every identifier from this source |
| `git` | repository URL; cloned at depth 1 |
| `ref` | branch, tag or commit; `main` by default |
| `path` | local folder, for development; exclusive with `git` |
| `locale` | BCP 47 tag (`en`, `fr`, `fr-CA`…); defaults to `project.locale`. Selects the language pack of the source: text normalisation, default stopwords, plural rules, word segmentation and the collation of its indexes, plus the profile's type prefixes for that locale. The engine ships `en` and `fr`; a regional variant uses the pack of its language; other languages come from plugins, which register their pack. A tag with no pack is a build error |
| `type` | forces the type of every markdown file |
| `default_type` | type when nothing else applies; `document` by default |
| `application` | default application for the source; a rule's `set: { application }` and the frontmatter override it |
| `glossary` | `true` marks the source as a glossary: its titles and aliases take priority in the recognition dictionary |
| `convert` | `true` enables office conversion for this source |
| `previews` | `false` keeps previews out of the artefact for this source |
| `rules` | typing rules, evaluated in order; the last match wins |

A rule matches on `path` (glob), `suffix` (`.rule.md`), `ext` (`[".vtt"]`) or `frontmatter` (a key that must be present), and sets any attribute, most often `type`:

```yaml
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    application: concordance-cli
    rules:
      - match: { path: "screens/**" }
        set: { type: screen }
      - match: { path: "api/**" }
        set: { type: api }
      - match: { suffix: ".rule.md" }
        set: { type: rule }
      - match: { suffix: ".table.md" }
        set: { type: data_object }
  - name: meetings
    git: https://example.invalid/knowledge/meetings.git
    default_type: meeting
    convert: true
```

The full cascade, increasing precedence: `default_type`, `type`, `rules` in order, frontmatter. The origin is kept on the entity (`type_origin`) and shown in the site.

### Private repositories

Concordance never stores a token and never asks for one: `concordance.yaml` is versioned and often public. Credentials come from the git environment of the machine or pipeline, like any `git clone`, and the build disables git's terminal prompt so that a repository it cannot reach fails immediately with a `W-SOURCE-UNREACHABLE` finding instead of waiting for a password.

GitHub Actions, repositories of the same organisation, with a token stored as a secret:

```yaml
      - run: git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"
        env:
          TOKEN: ${{ secrets.KNOWLEDGE_READ_TOKEN }}
      - run: concordance build
```

GitLab CI, repositories of the same instance:

```yaml
  before_script:
    - git config --global url."https://gitlab-ci-token:${CI_JOB_TOKEN}@${CI_SERVER_HOST}/".insteadOf "https://${CI_SERVER_HOST}/"
```

SSH: declare the source with a `git@` URL and give the pipeline a read-only deploy key. On a workstation, the credential helper of the operating system applies.

## `staleness`

Days after which a source or a note is flagged `W-STALE`, with a default and per-source overrides:

```yaml
staleness:
  warn_after_days: { default: 60, glossary: 120 }
```

The home page reads the same thresholds: its freshness entry flags a source dormant when its newest change, by the git date of its notes, is older than its threshold at the instant of the build; without the key, 180 days.

## `inference`

| Key | Default | Meaning |
|---|---|---|
| `glossary_sources` | sources with `glossary: true` | names of the sources whose entities take priority in the recognition dictionary: when the same form names several entities, theirs come first. When the key is present, even empty, it replaces the `glossary: true` marks |
| `stopwords` | language pack | extra stopword files, resolved against the folder of `concordance.yaml`, one word per line, `#` starts a comment; added on top of the defaults of the language pack. A title or alias that is a stopword, or a phrase made only of stopwords, never enters the dictionary; stopwords are compared on the same normalised form as terms. A file that does not exist fails the build |
| `short_terms` | `[]` | allow-list of terms whose normalised form is shorter than three characters (`[FP, VL]`); every other such title or alias is left out of the dictionary. Compared without regard to case or accents |
| `type_prefixes` | language pack | words that announce a type (`screen`, `API`, `table`) and add 0.1 confidence; the defaults are those of the profile for the locale of the source |
| `cross_source_links` | `false` | resolve markdown links across sources, written with a `source:` prefix or as a relative path climbing into a sibling source; `W-LINK-CROSS-SOURCE` otherwise |
| `ngrams` | `{ min: 1, max: 4, min_occurrences: 3, min_documents: 2 }` | candidate expression discovery: the lengths of the n-grams read over the text units of every note and document, and the thresholds a candidate must reach (occurrences and distinct files) to be kept. An n-gram starting or ending with a stopword, made only of digits, shorter than three characters, already in the dictionary or listed in the lock's `rejected_terms` is never a candidate |
| `keyword_pages` | `{ min_occurrences: 3, min_files: 2 }` | publication threshold of a keyword page: a discovered expression gets a page under `keywords/<slug>` only from `min_occurrences` occurrences in `min_files` distinct files. Below the threshold it stays in the output for the search index but has no page. Distinct from `ngrams`: `ngrams.min_occurrences` and `ngrams.min_documents` decide which expressions the discovery keeps at all (and can report as `W-TERM-UNDEFINED`), `keyword_pages` decides which of them become pages; lowering `keyword_pages` below `ngrams` has no effect. The build summary reports `keyword pages` and `expressions under the threshold` |
| `neighbours` | `{ k: 50 }` | `k` is the number of co-occurrence neighbours kept per node, ranked by the number of shared paragraphs then by identifier; it bounds the memory of the accumulation and the size of the `neighbours` block of `model.json` (see the [architecture guide](architecture.md#bounded-neighbourhood)) |
| `candidate_score` | 4.0 | score from which a candidate yields [`W-TERM-UNDEFINED`](../checks/W-TERM-UNDEFINED.md); the score is the C-value of the expression multiplied by its IDF, both described on the check page |
| `duplicates` | see below | how the twin resources of one document (a deck, its notes, its transcript) are reconciled |

### `inference.duplicates`

Two resources are scored by adding their signals, capped at 1: an explicit frontmatter `source` declaration (1.0), the same base name in the same folder (0.7) or elsewhere (0.5), base names at Jaro-Winkler 0.9 or more (those weights times 0.8), the property title of one equal to the level-one heading of the other (0.6), similar extracted text (0.7 from an estimated Jaccard index of 0.8, 0.4 from 0.6), the same commit (0.3) and the folder proximity (up to 0.2). Above `merge_above` the resources become one entity with several representations; from `candidate_above` they stay separate and a [`W-DUP-CANDIDATE`](../checks/W-DUP-CANDIDATE.md) finding names the score and every signal. The commit and the folder only reinforce a pair found by a declaration, a base name, a title or its text. See the [architecture guide](architecture.md#twin-resources).

| Key | Default | Meaning |
|---|---|---|
| `mode` | `auto` | `estimate` never recomputes the exact Jaccard index and reports the MinHash estimate; `exact` recomputes it on every pair the LSH banding brings together; `auto` recomputes it on the pairs estimated at `exact_above` or more |
| `exact_above` | 0.5 | estimated index from which `auto` recomputes the exact one, on the full shingle sets, and adds the share of common lines to the finding |
| `size_ratio_min` | 0.5 | word-count ratio (shorter over longer text) under which the content signal is capped at 0.4 and the finding says the pair looks like an inclusion rather than a duplicate |
| `shingle_size` | 5 | words per shingle of the comparison form |
| `minhash_functions` | 128 | hash functions of a signature, four per LSH band |
| `merge_above` | 0.9 | score strictly above which resources merge |
| `candidate_above` | 0.5 | score from which a finding is produced |

Build time against precision: the estimate alone visits every candidate pair once through its 128-value signature, the exact index re-reads the two full shingle sets of a pair, and `auto` spends that only on the pairs that are already close. Lowering `exact_above` or choosing `exact` makes the index in the findings exact on more pairs at the cost of build time, `estimate` makes the build fastest with an index accurate to about one tenth. The build summary reports the pairs brought together by the banding, the pairs scored, the exact verifications and the time spent.


## `conversion`

| Key | Default | Meaning |
|---|---|---|
| `timeout_s` | 120 | per document |
| `max_size_mb` | 50 | larger files are not converted |
| `cache` | `.concordance-cache` | cache folder, outside `dist/` |
| `parallelism` | number of cores | concurrent conversions |

The converted files are keyed by the SHA-256 of their source under `<cache>/convert/`, so that an unchanged document is never reconverted, even when it moves. The cache never enters `dist/`: keep it in the pipeline cache between builds, and delete it to force a full reconversion. A document above `max_size_mb` or past `timeout_s` yields a [`W-CONV-FAILED`](../checks/W-CONV-FAILED.md) finding and stays downloadable; `parallelism` changes the build time, never the output.

## `build`

| Key | Default | Meaning |
|---|---|---|
| `output` | `./dist` | site folder |
| `fail_on.errors` | `true` | fail when any error finding exists |
| `fail_on.unconverted_max` | 10 | fail beyond this many unconverted documents |
| `mentions_inline` | 20 | mentions of an entity served in its page; the rest comes from the `fragments/<id>.mentions.json` of the entity |
| `extracted_text_max_chars` | 20000 | extracted text indexed per document |

`fail_on` is the only thing that makes the build fail on content: an anomaly is always recorded as a finding and the build goes on. With the defaults, one error finding is enough to exit with code 1, and so is the eleventh unconverted document; the log and the summary are written either way. A project that wants a site whatever the state of its notes declares:

```yaml
build:
  fail_on: { errors: false, unconverted_max: 100 }
```

`--output` on the command line overrides `output`; the folder receives `build.log.json` with the summary and every finding, sorted.

`mentions_inline` bounds what the mentions panel of an entity page carries in the served HTML: that many mentions, readable without JavaScript, grouped by citing file. The others stay in the JSON fragment of the entity, one file per entity, which the panel loads on demand; under two hundred mentions in all they also travel in the page, inside a script block, so that no request is needed. `0` serves no mention inline and leaves everything to the fragment; a large value trades page weight against requests. The [theming guide](theming.md#mentions-panel) describes the three regimes.

## `site`

| Key | Default | Meaning |
|---|---|---|
| `neighbourhood.size` | 6 | nodes of the neighbourhood mini-map of a page, an integer from 1 to 12; a larger value is a configuration error, the map being legible only up to twelve labelled nodes; which nodes are kept follows the `display.neighbours_order` of the page's type in the profile (see the [architecture guide](architecture.md#displayed-neighbourhood)) |

```yaml
site:
  neighbourhood: { size: 8 }
```

## `checks`

Enable, disable or re-severitise a check:

```yaml
checks:
  W-TERM-UNUSED: { severity: info }
  W-STALE: { enabled: false }
```

Each key is a check identifier from the [check catalogue](../checks/README.md). `enabled: false` removes the check entirely: it is not run, and the findings a pipeline step reports under that identifier are dropped from the build log and the model. `enabled: true`, the default, keeps it. `severity` replaces the default severity on every finding of that check, including a finding the check itself reported at another severity (a plugin whose optional dependency is missing reports `W-PLUGIN-DISABLED` as `info`; `severity: warning` makes every such finding a warning). Both keys combine: a disabled check produces nothing whatever its severity. A key that names no registered check, built-in or contributed by a loaded plugin, is a configuration mistake: the build and the linter stop with an execution error (exit code 2) that names the identifier, rather than silently ignoring the override.

The same block, in a `concordance-lint.yaml` at the root of a knowledge repository, overrides severities locally for the linter.

## `concordance-lint.yaml`

Read by `concordance lint` at the root of the linted repository; the build ignores it. The file carries two blocks: `checks`, with the same shape and the same rules as above, and `global`, which says where the [global scope](getting-started.md#global-scope) finds the published model:

```yaml
checks:
  E-LINK-BROKEN: { severity: warning }
  W-STALE: { enabled: false }
global:
  model: https://concordance-wiki.github.io/demo-wiki/model.json
  cache_dir: .concordance-cache/lint
  max_age_hours: 24
```

A `checks` entry replaces the entry of the same check given under `checks` in the `concordance.yaml` passed with `--config`; the other entries of the configuration still apply. An empty file overrides nothing.

| Key | Default | Effect |
|---|---|---|
| `global.model` | none | the published `model.json` of the wiki: a URL (`https://…/model.json`) fetched and cached, or a path relative to the repository (`../wiki/dist/model.json`) read as it is; without it `--scope global` degrades to the local checks |
| `global.cache_dir` | `.concordance-cache/lint` | where the fetched model and its `model.meta.json` (fetch date, source URL, `ETag` and `Last-Modified` when the server gave them) live, relative to the repository |
| `global.max_age_hours` | `24` | how long the cached model is reused without any request; `0` revalidates on every run, with the validators the server gave |
| `global.profile` | none | a project profile, relative to the repository, merged over the default one for the relation matrix and the types of the global checks |

Any other top-level key, a key that is not a check identifier, an unknown check, a value outside `severity` and `enabled`, an unknown `global` key, an empty `model` or a negative `max_age_hours` stops the linter with an execution error (exit code 2) naming the file and the key.

## `lock`

Path to `concordance.lock.yaml`. See [`schemas/lock.schema.json`](../../packages/core/schemas/lock.schema.json). Only `rejected_terms` is read in the first version. Under `duplicates`, `merged` lists pairs of resource identifiers that merge whatever their score, and `separated` pairs that never merge and produce no finding; the reconciliation engine (`resolveDuplicateResources` of the inference package) applies both pairs it is given.

## `theme.yaml`

See [`schemas/theme.schema.json`](../../packages/core/schemas/theme.schema.json) and the theme shipped in [`brand/theme.yaml`](../../brand/theme.yaml) as an example; `fixtures/plugins/theme-white-label/theme/theme.yaml` shows a complete white-label one. Paths are relative to the file. A faulty key is reported by its path (`light.accent`, `footer.credit`), a named file that does not exist by its key; the [theming guide](theming.md#white-label) says what each key changes in the site. The accent colour never carries information on its own.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | the name of the site, in the header and every page title |
| `logo` | path | — | the logo before the name; an SVG is inlined, any other image copied under `assets/` |
| `favicon` | path | — | copied under `assets/` and linked from every page |
| `font.display`, `font.ui`, `font.mono` | string | platform fonts | the families of headings, interface and code; the files are shipped by the project through `assets` and `@font-face` rules in `stylesheet`, never fetched from another host |
| `radius` | integer | `8` | corner radius in pixels |
| `light`, `dark` | object | required | `bg`, `surface`, `border`, `ink`, `muted`, `accent`, each a `#RRGGBB` colour; text must reach 4.5:1 over `bg` and `surface`, headings 3:1 |
| `default_mode` | `system`, `light`, `dark` | `system` | the palette the site starts with; the reader's own choice, remembered by the mode switch, wins |
| `footer.text` | string | — | a paragraph in the footer |
| `footer.links` | `{ label, url }[]` | — | links in the footer |
| `footer.credit` | boolean | `false` | shows "Built with Concordance" as a link to the repository; nothing else in the interface names the tool |
| `stylesheet` | path | — | a stylesheet loaded after the tool's own, in the `project` cascade layer |
| `assets` | path | — | a folder copied as-is under `assets/` (fonts, icons) |
| `labels` | object | — | message overrides, below |

### `labels`

Every label of the generated site comes from a message catalogue per language, shipped by [`@concordance-wiki/i18n`](../../packages/i18n/README.md) in ICU MessageFormat: `en` is the source, `fr` a complete translation, and a project whose locale has no catalogue gets the source labels. The `labels` block overrides any message, by language of a shipped catalogue then by message identifier; the identifiers are the keys of [`messages/en.json`](../../packages/i18n/messages/en.json), whose `description` says where each label appears.

```yaml
labels:
  en:
    site.home: Start
    entity.mentionsCount: "{count, plural, one {# citation} other {# citations}}"
  fr:
    site.home: Début
```

An override is written in the same syntax as the message it replaces and must use exactly the variables of the source message. An unknown identifier, a syntax error or a missing or extra variable is a configuration error that names the faulty key (`labels.fr.site.home` style), reported with the other theme errors. The block of the language the build uses is the only one applied: a project in `fr-CA` takes `labels.fr`.

## Continuous integration

Build and publish with GitHub Actions:

```yaml
name: wiki
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 5 * * *" }]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc }
      - run: npm install --global concordance
      - run: concordance build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

The same with GitLab CI:

```yaml
pages:
  image: node:lts
  script:
    - npm install --global concordance
    - concordance build --output public
  artifacts:
    paths: [public]
  cache:
    paths: [.concordance-cache]
```

Add LibreOffice to the image when office conversion is wanted. Keep `.concordance-cache` in the pipeline cache so that unchanged documents are not reconverted.

### With the container image

The [container image](getting-started.md#with-the-container-image) removes the Node.js and LibreOffice setup from the pipeline: it carries both, and the pipeline only mounts the configuration repository on `/wiki`. On GitHub Actions the runner has Docker; mount the checkout and run the image directly:

```yaml
name: wiki
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 5 * * *" }]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with: { path: .concordance-cache, key: concordance-cache }
      - run: docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

On GitLab CI the job runs inside the image itself, whose entry point is the `concordance` command; the runner's checkout is the working directory, so no mount is needed:

```yaml
pages:
  image:
    name: concordancewiki/concordance
    entrypoint: [""]
  script:
    - concordance build --output public
  artifacts:
    paths: [public]
  cache:
    paths: [.concordance-cache]
```

The image runs as uid 1000, so the working directory of the job must be writable by that user; when the runner prepares it as another user, the `user` setting of its executor runs the job as that user instead. Pin a version tag (`concordancewiki/concordance:1.2.0`) in a pipeline that must not change under your feet.

### Lint a knowledge repository in its merge requests

Each knowledge repository checks itself on every merge request with `concordance lint`; `--format` gives the forge a report it annotates the diff with. On GitHub, upload the SARIF log to code scanning: each finding then appears in the margin of the diff, on its file and line, and the pipeline still fails according to `--fail-on`.

```yaml
name: lint
on: { pull_request: {} }
jobs:
  lint:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - run: npx concordance lint --format sarif --output concordance.sarif
        continue-on-error: true
      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: concordance.sarif }
```

On GitLab, publish the JUnit report: the merge request lists each finding as a failed test, with its message, remediation and documentation URL.

```yaml
lint:
  image: node:lts
  script:
    - npx concordance lint --format junit --output concordance-junit.xml
  artifacts:
    when: always
    reports:
      junit: concordance-junit.xml
```

Both examples run the linter at the root of the knowledge repository; pass `--config` and `--source` when the repository is declared in a `concordance.yaml` whose rules must apply. The exit code is the same whatever the format: 0 without a finding at the `--fail-on` severity, 1 with one, 2 when the lint could not run.

The GitHub action `concordance-wiki/lint-action` and the GitLab CI/CD component `concordance-wiki/lint/lint` wrap these two examples in one line each, with the version of the linter pinned; [Distributing the linter](lint-distribution.md) shows them, with the standalone binary, the container image and the pre-commit hook.
