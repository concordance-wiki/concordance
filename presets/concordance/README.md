<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/concordance</h1>

<p align="center"><strong>One command. A wiki where every word of your business has a page.</strong></p>

<p align="center">
  Your team writes markdown for the AI. Concordance turns it into a wiki for the humans.<br>
  Point it at your git repositories and get a site where every word of your business has a page.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/concordance"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/concordance?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md">Command line</a> ·
  <a href="https://concordance-wiki.github.io/demo-wiki/">Demo</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/presets/concordance/CHANGELOG.md">Changelog</a>
</p>

---

## The problem

We now spend our days structuring knowledge for assistants: transcripts, specifications, glossaries, decisions, all in markdown, all in git. The AI reads it fine. We don't. It is scattered across repositories, nobody reads it twice, and nothing tells you that the term defined in the glossary is used in two hundred files, or that a decision taken in a meeting affects three screens.

Concordance takes those repositories **exactly as they are** and builds a wiki where every word your business uses has a page: the note someone wrote, if any, and every passage, in every file, that mentions it.

<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/docs/assets/screenshot-home.png" width="100%" alt="The home page of the wiki Concordance builds from its own repositories: a search field, the most cited words, the spaces fed by three repositories with their page counts and dates, the recently changed pages, and the footer saying where the site comes from">
</p>

No rewriting. No wikilinks. No frontmatter required. No server to run.

## One command

This is the package to install: the `concordance` command (`conc` for short) with every official reader and converter plugin, so that a configuration can declare any of them without installing anything else.

```bash
npm install --global @concordance-wiki/concordance
concordance --help
```

Or without installing:

```bash
npx @concordance-wiki/concordance build      # clones your repositories, builds dist/, publish it anywhere
npx @concordance-wiki/concordance lint       # checks one repository before you push: broken links, duplicates, gaps
```

Or turnkey with Docker, LibreOffice and git inside:

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
```

`dist/` is a static folder. Drop it on GitHub Pages, GitLab Pages or a bucket. It works over `file://` too.

## Quick start

From nothing to a built wiki:

```bash
mkdir my-wiki && cd my-wiki
concordance init --templates
concordance validate-config
concordance build
```

`init` writes a minimal, commented `concordance.yaml` declaring one local source, `./notes`; edit it to point at your repositories and to declare the plugins the wiki needs:

```yaml
# concordance.yaml
version: 1
project: { name: My wiki }
sources:
  - name: glossary
    git: https://forge.example/knowledge/glossary.git
  - name: specs
    git: https://forge.example/knowledge/specs.git
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - "@concordance-wiki/plugin-reader-office"
  - "@concordance-wiki/plugin-convert-libreoffice"
```

## What you get

- **A page per word**, written or not, with every passage that uses it and a link to the source line.
- **Search that works without a server**, with facets by type, repository and domain.
- **Document previews**: Word, PowerPoint, PDF, VTT transcripts, reconciled with their markdown twins; transcripts are pseudonymised at build and published only on explicit request.
- **A to-do page**: words without a note, documents without markdown. The shortest path to a better corpus.
- **A linter for your CI**: broken links, duplicate identifiers, invalid frontmatter, undefined terms, annotated in the merge request.
- **Your brand**: name, logo, colours, light and dark. No mention of the tool unless you want one.
- **Evidence everywhere**: every link says where it comes from. Written links always beat inferred ones.
- **Structure when you want it**: tell it that everything under `screens/` is a screen and every `.rule.md` is a rule; nothing is ever required, and nothing you add stops working if you stop.

## What it contains

- `bin/concordance.js`, the `concordance` and `conc` executables, which run the command line of [`@concordance-wiki/cli`](https://www.npmjs.com/package/@concordance-wiki/cli): `build`, `export`, `gallery`, `init`, `lint`, `mcp`, `query`, `render`, `validate-config`.
- [`@concordance-wiki/plugin-reader-vtt`](https://www.npmjs.com/package/@concordance-wiki/plugin-reader-vtt): reader for `.vtt` and `.srt` transcripts.
- [`@concordance-wiki/plugin-reader-office`](https://www.npmjs.com/package/@concordance-wiki/plugin-reader-office): metadata reader for `.docx`, `.pptx`, `.xlsx` and `.pdf`.
- [`@concordance-wiki/plugin-convert-libreoffice`](https://www.npmjs.com/package/@concordance-wiki/plugin-convert-libreoffice): conversion of office documents to PDF and extraction of their text; needs LibreOffice on the machine.
- [`@concordance-wiki/plugin-contract-openapi`](https://www.npmjs.com/package/@concordance-wiki/plugin-contract-openapi): import of the OpenAPI 3.x contract an `api` note declares, one page per operation.
- [`@concordance-wiki/plugin-contract-wsdl`](https://www.npmjs.com/package/@concordance-wiki/plugin-contract-wsdl): import of the WSDL 1.1 and 2.0 contract an `api` note declares, one page per operation.
- No code of its own.

## Documentation

- [Getting started](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md): from an empty folder to a published site, in seven steps
- [Command line](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md): what each command reads, writes and returns
- [Configuration](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md): sources, typing rules, domains, thresholds, checks
- [Pipelines](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/pipelines.md): build and publish on GitHub Pages and GitLab Pages, lint in a merge request
- [Operations](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/operations.md): build time and weight to expect, the cache, the container image
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/presets/concordance/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

The package holds no code of its own: `bin/concordance.js` imports the executable of the command line, and the dependencies are what adds the plugins. The container image `concordancewiki/concordance` is built from this package by the `Dockerfile` at the root of the repository.

</details>
