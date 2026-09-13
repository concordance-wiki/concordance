# Getting started

Concordance is pre-alpha: the commands below describe the intended experience and will work once the first packages are published. Until then, this page is the contract the implementation must honour.

## Requirements

- Node.js LTS (see `.nvmrc`).
- git.
- LibreOffice, only if you want office documents converted and previewed. Without it, documents stay downloadable entities and the build says so.

## Install

```bash
npm install --global concordance
```

The `concordance` package is a preset: it installs the core and every official plugin. The command is `concordance`, with `conc` as a short alias.

Without Node.js, use the [container image](#with-the-container-image), which also carries LibreOffice for document conversion:

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
```

The image runs the same command line; mount the configuration repository on `/wiki`.

### With the container image

`concordancewiki/concordance` is published on Docker Hub at every release, tagged by version and `latest`, and built from the `Dockerfile` of the repository. It carries Node.js LTS, the `concordance` preset with every official plugin, git, headless LibreOffice and the fonts the conversion needs (metric-compatible substitutes for the usual office fonts, and a fallback face). Its entry point is the `concordance` command, so every command of this guide runs the same way with the configuration repository mounted on `/wiki`:

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance init
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance validate-config
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance lint
```

`build` writes `dist/` into the mounted folder, next to `concordance.yaml`, like the installed command. The conversion cache lives under `/wiki/.concordance-cache`; mount a named volume there so that unchanged documents are not reconverted from one run to the next, and so that the cache never lands in the configuration repository:

```bash
docker run --rm -v "$PWD:/wiki" -v concordance-cache:/wiki/.concordance-cache concordancewiki/concordance build
```

The image runs unprivileged, as the user `concordance` (uid 1000), and writes nothing but `dist/` and the cache. On Linux the files it writes belong to uid 1000; when your user has another uid, run the container as yourself so that `dist/` stays yours: `--user "$(id -u):$(id -g)"` (the mounted folder and the cache volume must then be writable by that user). Docker Desktop on macOS and Windows maps the ownership for you. `SOURCE_DATE_EPOCH` is not set in the image: pass it (`-e SOURCE_DATE_EPOCH=0`) when you want [reproducible builds](#reproducible-builds).

## Create a configuration repository

A Concordance site is described by one repository that holds the configuration, the theme and the stopwords. It never holds content.

```bash
mkdir my-wiki && cd my-wiki
git init
concordance init
```

`concordance init` writes a minimal, commented `concordance.yaml` and refuses to overwrite one that exists. Add `--templates` to also receive the [note templates](../templates/README.md), one per type, under `templates/`: copy one into a knowledge repository whenever you start a note. Existing files under `templates/` are kept and reported. Edit `concordance.yaml` to declare your sources:

```yaml
version: 1
project:
  name: My wiki
  locale: en
sources:
  - name: glossary
    git: https://example.invalid/knowledge/glossary.git
    type: term
    glossary: true
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    rules:
      - match: { path: "screens/**" }
        set: { type: screen }
```

`example.invalid` is a placeholder: put the URLs of your own repositories. A local path (`path: ../glossary`) works for development.

## Validate and build

```bash
concordance validate-config
concordance build
```

`validate-config` checks the file against the published schema and prints one line per problem: the path of the faulty key, the value received, the values expected. It exits with 0 when the configuration is valid, 1 when it is not, 2 when the file cannot be read. `build` runs the same validation as its first step and stops there when it fails, then loads the profile (the default one, merged with `profile` when the configuration names one; an invalid profile stops the build the same way), loads the plugins declared under `plugins:`, fetches every source into `.concordance-cache/sources/` (depth 1, updated on the next build) without ever writing into a source, and runs the inference chain described in the [architecture guide](architecture.md#the-build-pipeline): it parses every markdown file, types the notes, lets the source plugins import the contracts the API notes declare, builds the recognition dictionary of every locale, scans every note for the titles and aliases it holds, produces the links (written links, frontmatter references, mentions in sections and prose, co-occurrence), combines their confidences, discovers the recurring expressions without a note and publishes the keyword pages above the threshold, reconciles the notes that look like twin resources, runs the model checks, and writes `dist/model.json`, the [canonical model](architecture.md#canonical-model), with `dist/build.log.json` and one fragment per entity under `dist/fragments/`; then it renders the site from those files alone, as `concordance render` does. A source it cannot reach is reported and skipped; see [private repositories](configuration.md#private-repositories) for credentials.

The summary at the end reports entities per type, links per method, keyword pages generated and expressions under the threshold, the twin-resource statistics, and findings per severity and per check, then what the rendering wrote: the number of pages, the size of each island bundle, the largest page against the 150 kB budget, the accessibility findings and the palette pairs under the contrast minimum.

### The site

`dist/` holds the whole site once the build ends. Open `dist/index.html` in a browser: no server is needed, every link is relative and every page sits in its own folder as `index.html`, so the site reads over `file://` as it does behind a server, without any URL rewriting.

| Path | What it is |
|---|---|
| `index.html` | the home page: the project name, the most cited entities as shortcuts, the counts of sources and files, and three entry points counting the entities by domain, by type and by application |
| `<id>/index.html` | one page per entity, at the address of its identifier (`glossary/keyword-page/index.html`): the type badge with the highlighted properties the profile names (two next to the badge, five at most), the title, then the note rendered to HTML at full width, section by section, its written links and recognised words marked and explained by a legend; the declared properties in a side panel, the neighbourhood, the mentions, and the footer naming the source file (`source: glossary/keyword-page.md`) with an edit link to the forge when the source is a GitHub or GitLab repository or `project.edit_url` is set; a keyword page shows its counts, its passages grouped by file and its accompanying words instead. The images a note embeds from its repository sit next to the page, under `<id>/` |
| `index/index.html` | the alphabetical index of every page, letters first, each entry with its type glyph or the "no note" mark and its citation count |
| `todo/index.html` | the to-do page: the words above the threshold without a note, most cited first, and the documents without a markdown representation |
| `search-index.json` | a placeholder for the search index: one entry per page with its identifier, title, type and URL, until the search exists |
| `assets/` | `site.css`, the project stylesheet when `theme.yaml` names one, the island bundles named after their content, and the favicon and logo of the theme |
| `model.json`, `build.log.json`, `fragments/` | what the build wrote for the rendering, kept next to the site; see below |

The URL of a page follows the identifier of its entity and nothing else, so it stays the same from one build to the next as long as the identifier does. The main content of every page is in the served HTML: the text of the note, the section headings, the neighbours and the first mentions read without JavaScript, which only adds the mode switch and the disclosure of the remaining mentions. No preview of converted documents is written yet.

### Render again without the sources

```bash
concordance render
```

`render` reads `dist/model.json` and the fragments next to it, and writes the site again under the same folder: after a change of `theme.yaml`, of the labels, or of the tool itself, the pages are rebuilt without cloning a source or running the inference chain. `--model` names another model file (its fragments are read from the folder holding it), `--output` another folder, `--config` another configuration; the configuration and the profile are read as the build reads them, for the site title, the locale, the plugins that bring a theme and the labels of the types. The command exits 0 when the site is written, 1 when the configuration, the profile, the theme or the model is invalid, 2 when the configuration or the model file is missing. A page over the budget or with an accessibility finding is a warning on stderr and in the summary, never a failure.

The fragments are what lets the rendering forget the sources. The build writes `dist/fragments/<id>.json` for every entity: the note rendered to sanitised HTML, one section per heading with its identifier, its heading and its HTML, the written links already turned into page hrefs and marked `written`, every word the occurrence scan recognised wrapped in a `recognised` link to its page; the list of the images the note embeds from the sources, whose bytes the build keeps under `dist/fragments/<id>/…` and `render` places next to the page; for a keyword page, the passages where the expression was read, with their source, file, line and context. `render` reads them by identifier and renders an entity without one with no note text, with a warning that counts them.

### Findings and exit codes

A content anomaly never stops the build: a file that is not UTF-8, a broken frontmatter or an unreachable source becomes a finding with an identifier, a severity, the file and line, a message and a remediation (see the [check pages](../checks/README.md)). Every finding is printed on stderr, and the summary on stdout counts sources, files, findings per severity and per check. The findings and the summary are written to `dist/build.log.json` (the folder is `--output`, else `build.output`, else `dist/` next to the configuration); the same `findings` array is embedded in `model.json`. The only timestamp in the log is its `at` field.

Whether the build fails is decided by `build.fail_on` alone: by default it fails when any error finding exists and when more than ten documents could not be converted (`fail_on.errors`, `fail_on.unconverted_max`, see the [configuration guide](configuration.md#build)). Exit codes: 0 when the build succeeds, 1 when the configuration or the profile is invalid or the findings exceed `build.fail_on`, 2 on an execution error (a plugin that cannot be loaded, a missing stopword file). The log, the model, the fragments and the site are written before the verdict, so a failing build still leaves them for inspection.

### Export the graph

```bash
concordance export --format cypher --output graph.cypher
```

`export` reads `dist/model.json` (`--model` names another file), validates it against the published schema, and writes a Cypher script: one `MERGE` per entity with its properties, one per link with its confidence and methods. Without `--output` the script goes to stdout, so `concordance export | cypher-shell` loads the graph directly. Exit codes: 0 written, 1 when the model does not match the schema, 2 when the file is missing or the format is not `cypher`, the only one in this version.

### Reproducible builds

Two builds of unchanged sources write byte-identical files, so that `dist/` can be committed and diffed. Every list is written in a canonical order and nothing in the outputs depends on the clock, except the `at` field of the build log and of the `build` block of `model.json`. To pin that field too, set `SOURCE_DATE_EPOCH` to a number of seconds since the epoch, as reproducible-builds tooling does:

```bash
SOURCE_DATE_EPOCH=0 concordance build --output first
SOURCE_DATE_EPOCH=0 concordance build --output second
diff -r first second
```

The repository verifies this on every change: the golden corpora are built twice and every file under the two output folders is compared.

## Publish

`dist/` is a static folder that needs no server-side configuration. Copy it as is to GitHub Pages or GitLab Pages, to an object storage bucket served as a static website, or to any web server: every page is a folder holding an `index.html`, so `https://wiki.example/glossary/keyword-page/` and `https://wiki.example/glossary/keyword-page/index.html` both work, and the pages link to each other through relative paths that resolve wherever the folder lands, at the root of a domain or under a prefix. Opening `dist/index.html` from a file manager works too, for a review before publishing or for a copy on a shared drive. Pipeline examples for both forges are in the [configuration guide](configuration.md#continuous-integration). The model and the log ship with the site; leave `fragments/` out of the copy if you do not want the rendered notes published twice, or keep everything so that `concordance render` can run from the published folder.

## Lint a knowledge repository

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

The [configuration guide](configuration.md#continuous-integration) shows how to upload the SARIF log to GitHub and the JUnit report to GitLab.

## What the tool does not do

- It never writes into a knowledge repository, except `lint --fix`, which writes only the corrections it printed.
- It does not read source code.
- It does not run a server; anything that needs one (semantic search, questions in natural language, merge request creation) belongs to a separate, optional service that is not part of the first version.
- It does not correct typos in search: matching is by prefix.
- It does not publish transcripts unless the configuration asks for it explicitly, and it does not decide whether they may be published: [Publishing transcripts](publishing-transcripts.md) sets out what to settle first.

## Orders of magnitude

Measured on the reference corpus once the engine exists, and reported here. Until then: the occurrence scan is linear in text volume and takes seconds on a few thousand files; office conversion takes two to ten seconds per document on the first build and nothing on the next ones for unchanged files.
