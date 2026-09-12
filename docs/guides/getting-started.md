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

`concordance init` writes a minimal, commented `concordance.yaml` and refuses to overwrite one that exists. Edit it to declare your sources:

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

`validate-config` checks the file against the published schema and prints one line per problem: the path of the faulty key, the value received, the values expected. It exits with 0 when the configuration is valid, 1 when it is not, 2 when the file cannot be read. `build` runs the same validation as its first step and stops there when it fails, then loads the profile (the default one, merged with `profile` when the configuration names one; an invalid profile stops the build the same way), fetches every source into `.concordance-cache/sources/` (depth 1, updated on the next build) without ever writing into a source, parses every markdown file, types the notes, resolves the links written in them and writes `dist/model.json`, the [canonical model](architecture.md#canonical-model). A source it cannot reach is reported and skipped; see [private repositories](configuration.md#private-repositories) for credentials.

The build clones the sources at depth 1, parses the markdown, types the notes, records the occurrences, runs the checks and writes `dist/`. The summary at the end reports entities per type, links per method, findings per severity, keyword pages generated, and the weight of the index and the site.

### Findings and exit codes

A content anomaly never stops the build: a file that is not UTF-8, a broken frontmatter or an unreachable source becomes a finding with an identifier, a severity, the file and line, a message and a remediation (see the [check pages](../checks/README.md)). Every finding is printed on stderr, and the summary on stdout counts sources, files, findings per severity and per check. The findings and the summary are written to `dist/build.log.json` (the folder is `--output`, else `build.output`, else `dist/` next to the configuration); the same `findings` array is embedded in `model.json`. The only timestamp in the log is its `at` field.

Whether the build fails is decided by `build.fail_on` alone: by default it fails when any error finding exists and when more than ten documents could not be converted (`fail_on.errors`, `fail_on.unconverted_max`, see the [configuration guide](configuration.md#build)). Exit codes: 0 when the build succeeds, 1 when the configuration is invalid or the findings exceed `build.fail_on`, 2 on an execution error. In this version the build still stops after inference with exit code 2, once the log and the model are written.

Open `dist/index.html` in a browser. The site works over `file://`; no server is needed.

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

The repository verifies this on every change: the golden corpus is built twice and every file under the two output folders is compared.

## Publish

`dist/` is a static folder. Copy it to GitHub Pages, GitLab Pages or any bucket. Pipeline examples for both forges are in the [configuration guide](configuration.md#continuous-integration).

## Lint a knowledge repository

Each source can check itself before pushing, without the global build. From the root of the repository:

```bash
npx concordance lint
```

The command reads every markdown file under the current directory, one file at a time, and prints one line per finding, sorted by check, path and line, then a count:

```
error: notes/entry.md:3: E-LINK-BROKEN: link "cap.md" in notes/entry.md points to notes/cap.md, which does not exist (https://github.com/concordance-wiki/concordance/blob/main/docs/checks/E-LINK-BROKEN.md)
1 finding: 1 error, 0 warnings, 0 info
```

Options:

| Option | Default | Effect |
|---|---|---|
| `--scope repo` | `repo` | checks the current repository alone; `global` is not available in this version and is refused |
| `--source <name>` | none | names the source this repository is declared as, so that its rules apply: the type suffixes of its `rules` are stripped from identifiers; without `--config`, the name only prefixes the identifiers |
| `--config <file>` | none | the `concordance.yaml` that declares the source; its `privacy.exclude` and `checks` blocks apply |
| `--fail-on error\|warning\|info` | `error` | the severity from which a finding makes the command fail |
| `--format text\|json\|sarif\|junit` | `text` | the shape of the report; see [Reports for forges](#reports-for-forges) |
| `--output <file>` | none | writes the report to that file instead of standard output; the only file the command ever writes |
| `--fix` | | applies the safe corrections before the check, after printing each of them; see [Safe fixes](#safe-fixes) |
| `--dry-run` | | lists the corrections `--fix` would apply, prefixed with `would fix`, and writes nothing; implies `--fix` |

What is checked in this version: UTF-8 encoding (`E-ENCODING`), YAML frontmatter (`E-FM-INVALID`), frontmatter identifiers (`E-ID-INVALID`), unique identifiers with the source's suffixes stripped (`E-ID-DUP`) and internal links (`E-LINK-BROKEN`). A link with a `source:` prefix or one that climbs above the repository targets another source and is not checked locally. The type cascade and the checks that depend on it (`E-TYPE-CONFLICT`, section headings) join the local lint with the typing package.

In this mode the command never opens a network connection, and it writes nothing but the report named by `--output` and, under `--fix`, the corrected files. A `concordance-lint.yaml` at the root of the repository overrides severities locally; see the [configuration guide](configuration.md#concordance-lintyaml).

Exit codes, whatever the format: 0 when no finding reaches the `--fail-on` severity, 1 when one does, 2 when the lint could not run (unknown option or format, missing or invalid configuration, unknown source, faulty `concordance-lint.yaml`, `--scope global`).

### Safe fixes

`--fix` corrects what is mechanical and certain, then runs the check on the corrected files. Every correction is printed as `fix: <path>:<line>: <description>` before the first file is written, so that a log shows what changed:

```
fix: notes/entry.md:1: add the deduced "type: rule" to the frontmatter
fix: notes/entry.md:1: order the frontmatter keys: id, type, title, status
fix: notes/entry.md:7: rewrite link "cap.rule.md" to "../rules/cap.rule.md", the only file named cap.rule.md
refused: notes/entry.md:9: link "cap.md" matches several files: archive/cap.md, rules/cap.md; choose one
```

Three corrections exist:

- the deduced type: when a note has a frontmatter block without `type` and the source given by `--source` and `--config` deduces one (`default_type`, then `type`, then the `rules` in order, the last match winning), `type: <deduced>` is added. A note without frontmatter is left alone, since its type already comes from where it is filed, and the implicit `document` default is never written;
- the key order: the frontmatter keys are written as `id`, `type`, `title`, `aliases`, `status`, then the rest alphabetically. Comments travel with their key. A frontmatter that is not valid YAML is left untouched: `E-FM-INVALID` reports it;
- a renamed target: a link to a missing file is pointed at the only file of the repository carrying the same name and extension, as a path relative to the note, the anchor kept. Only the destination characters between `](` and `)` are replaced.

The fixer refuses, and says so on a `refused:` line, when several files carry the name, or when the destination is written between angle brackets. It never adds a link, never removes one, never touches the body of a note, and never writes a relation the tool inferred: the diff of a fixed file only shows the frontmatter block and existing link destinations. A second `--fix` on a fixed repository changes nothing.

The linter uses the same checks as the build. See the [check pages](../checks/README.md) for what each finding means and how to fix it; every finding line ends with the URL of its page.

### Reports for forges

`--format` picks a machine-readable report so that a merge request shows the findings where they belong instead of in a pipeline log. Each report holds the whole run alone on standard output, without the summary line, and `--output <file>` writes it to a file instead; the findings are sorted the same way in every format, so two reports of the same tree are byte-identical.

| Format | Content | Use it for |
|---|---|---|
| `json` | `{ version: 1, tool, findings, summary }`; each finding carries its check, severity, source, path, line, entity, message, remediation and documentation URL; `summary` counts errors, warnings and info | scripts and dashboards |
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
