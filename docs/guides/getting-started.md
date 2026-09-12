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

Without Node.js, use the container image, which also carries LibreOffice for document conversion:

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
```

The image runs the same command line; mount the configuration repository on `/wiki`.

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

`validate-config` checks the file against the published schema and prints one line per problem: the path of the faulty key, the value received, the values expected. It exits with 0 when the configuration is valid, 1 when it is not, 2 when the file cannot be read. `build` runs the same validation as its first step and stops there when it fails, then fetches every source into `.concordance-cache/sources/` (depth 1, updated on the next build) without ever writing into a source, and parses every markdown file. A source it cannot reach is reported and skipped; see [private repositories](configuration.md#private-repositories) for credentials.

The build clones the sources at depth 1, parses the markdown, types the notes, records the occurrences, runs the checks and writes `dist/`. The summary at the end reports entities per type, links per method, findings per severity, keyword pages generated, and the weight of the index and the site.

### Findings and exit codes

A content anomaly never stops the build: a file that is not UTF-8, a broken frontmatter or an unreachable source becomes a finding with an identifier, a severity, the file and line, a message and a remediation (see the [check pages](../checks/README.md)). Every finding is printed on stderr, and the summary on stdout counts sources, files, findings per severity and per check. The findings and the summary are written to `dist/build.log.json` (the folder is `--output`, else `build.output`, else `dist/` next to the configuration); the same `findings` array is embedded in `model.json`. The only timestamp in the log is its `at` field.

Whether the build fails is decided by `build.fail_on` alone: by default it fails when any error finding exists and when more than ten documents could not be converted (`fail_on.errors`, `fail_on.unconverted_max`, see the [configuration guide](configuration.md#build)). Exit codes: 0 when the build succeeds, 1 when the configuration is invalid or the findings exceed `build.fail_on`, 2 on an execution error. In this version the build still stops after parsing with exit code 2, once the log is written.

Open `dist/index.html` in a browser. The site works over `file://`; no server is needed.

## Publish

`dist/` is a static folder. Copy it to GitHub Pages, GitLab Pages or any bucket. Pipeline examples for both forges are in the [configuration guide](configuration.md#continuous-integration).

## Lint a knowledge repository

Each source can check itself before pushing, without the global build:

```bash
npx concordance lint --scope repo --source specs
```

The linter uses the same checks as the build. See the [check pages](../checks/README.md) for what each finding means and how to fix it.

## What the tool does not do

- It never writes into a knowledge repository.
- It does not read source code.
- It does not run a server; anything that needs one (semantic search, questions in natural language, merge request creation) belongs to a separate, optional service that is not part of the first version.
- It does not correct typos in search: matching is by prefix.
- It does not publish transcripts unless the configuration asks for it explicitly.

## Orders of magnitude

Measured on the reference corpus once the engine exists, and reported here. Until then: the occurrence scan is linear in text volume and takes seconds on a few thousand files; office conversion takes two to ten seconds per document on the first build and nothing on the next ones for unchanged files.
