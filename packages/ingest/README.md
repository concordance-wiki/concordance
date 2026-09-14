<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/ingest</h1>

<p align="center"><strong>Your repositories read exactly as they are: cloned, decoded, parsed, ready to scan.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/ingest"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/ingest?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md">Writing notes</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/ingest/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance turns the markdown your team writes for the AI into a wiki for the humans, without rewriting a line of it. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) for that. This package is the part of it that reads your repositories: it clones or lists every source, decodes each file as strict UTF-8, parses the markdown into its title, sections, links and frontmatter, and hands out the text units a scan may read, code and URLs left out. Install it alone to build on the engine.

## Quick start

```bash
npm install @concordance-wiki/ingest
```

```ts
import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";

const note = "---\ntype: term\n---\n# Occurrence scan\n\nThe scan reads every note.\n\n## Findings\n\n- one finding per missing target\n";
const document = parseMarkdown(note, { path: "glossary/occurrence-scan.md" });
document.title; // "Occurrence scan"
document.frontmatter; // { type: "term" }
document.sections.map((section) => section.heading); // ["Findings"]
scannableText(document).map((unit) => unit.text); // ["Occurrence scan", "The scan reads every note.", "Findings", "one finding per missing target"]
```

## What you get

- **Every source, fetched or listed**: `ingestSources` clones each declared repository into the cache or lists a local folder, applies the exclusions, and turns an unreachable source into a finding rather than a stop.
- **The date of every file**, from the history of its repository, so that "changed yesterday" on a page is always right.
- **Strict decoding**: `readMarkdown` reads a file as UTF-8 and reports `E-ENCODING` otherwise.
- **Markdown parsed once**: `parseMarkdown` gives the title, the H2 sections, the links with line and column, the images, code blocks, quotes, tables and paragraphs, and the frontmatter, `E-FM-INVALID` when the YAML is broken.
- **Links resolved** against the file, then against the source root, anchor kept: `resolveLink`.
- **What a scan may read**: `scannableText`, the text units with their line and enclosing section; code, URLs, raw HTML, frontmatter, images and link targets never appear.

## Documentation

- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md)
- [Architecture](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/architecture.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/ingest/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

`ingestSources` fetches every declared source into the cache (a clone with the whole history and without the blobs, updated when cached) or lists a local folder, lists its files as the linter does (`repositoryFiles` of the core: `privacy.exclude`, the `exclude` of the repository's `concordance-lint.yaml` and its `.gitignore` files applied before anything else is read; a faulty lint configuration skips the source with a `W-SOURCE-UNREACHABLE` finding), records the last commit and date of every file (from the repository holding a local folder too, for the files unchanged since their commit), and turns an unreachable source into a `W-SOURCE-UNREACHABLE` finding without stopping. `readMarkdown` decodes a file as strict UTF-8 (`E-ENCODING` and the file is skipped otherwise) and `parseMarkdown` turns CommonMark and GFM into the title, the H2 sections with their text and list items, the links with line and column, the images, code blocks, block quotes, tables and paragraphs, plus the frontmatter as an untyped record (`E-FM-INVALID` when the YAML is broken; the body is still parsed). `resolveLink` resolves a link target against the file, then against the source root, and keeps its anchor. `scannableText` gives the text units a scan may read (headings, paragraphs, list items, table cells and quoted paragraphs, each with its line and enclosing H2 section): fenced and indented code blocks, inline code, URLs, raw HTML, frontmatter, images and link targets never appear, the visible text of a link does.

</details>
