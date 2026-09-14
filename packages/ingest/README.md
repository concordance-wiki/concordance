# @concordance-wiki/ingest

The ingestion of a Concordance build: the sources cloned or listed, the files read as strict UTF-8, the markdown parsed into its title, sections, links and frontmatter, and the text units a scan may read. Installed by `@concordance-wiki/cli`; you need it only to build on the engine.

## Install

```bash
npm install @concordance-wiki/ingest
```

## Use

```ts
import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";

const note = "---\ntype: term\n---\n# Occurrence scan\n\nThe scan reads every [note](../notes/note.md).\n";
const document = parseMarkdown(note, { path: "glossary/occurrence-scan.md" });
document.title; // "Occurrence scan"
document.frontmatter; // { type: "term" }
document.links.map((link) => link.target); // ["../notes/note.md"]
scannableText(document).map((unit) => unit.text); // ["Occurrence scan", "The scan reads every note."]
```

## What it contains

- `ingestSources`: fetches every declared source into the cache or lists a local folder, applies the exclusions, records the last commit and date of every file and turns an unreachable source into a finding.
- `readMarkdown`: decodes a file as strict UTF-8, `E-ENCODING` otherwise.
- `parseMarkdown`: CommonMark and GFM into the title, the H2 sections, the links with line and column, the images, code blocks, quotes, tables and paragraphs, plus the frontmatter (`E-FM-INVALID` when the YAML is broken).
- `resolveLink`: a link target resolved against the file, then against the source root, its anchor kept.
- `scannableText`: the text units a scan may read, each with its line and enclosing section; code, URLs, raw HTML, frontmatter, images and link targets never appear.
- `IngestedSource`, `IngestedFile`, `ParsedMarkdown` and the other types of what the pipeline reads.

## Documentation

- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md)
- [Architecture](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/architecture.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/ingest/CHANGELOG.md)

## Inside

`ingestSources` fetches every declared source into the cache (a clone with the whole history and without the blobs, updated when cached) or lists a local folder, lists its files as the linter does (`repositoryFiles` of the core: `privacy.exclude`, the `exclude` of the repository's `concordance-lint.yaml` and its `.gitignore` files applied before anything else is read; a faulty lint configuration skips the source with a `W-SOURCE-UNREACHABLE` finding), records the last commit and date of every file (from the repository holding a local folder too, for the files unchanged since their commit), and turns an unreachable source into a `W-SOURCE-UNREACHABLE` finding without stopping. `readMarkdown` decodes a file as strict UTF-8 (`E-ENCODING` and the file is skipped otherwise) and `parseMarkdown` turns CommonMark and GFM into the title, the H2 sections with their text and list items, the links with line and column, the images, code blocks, block quotes, tables and paragraphs, plus the frontmatter as an untyped record (`E-FM-INVALID` when the YAML is broken; the body is still parsed). `resolveLink` resolves a link target against the file, then against the source root, and keeps its anchor. `scannableText` gives the text units a scan may read (headings, paragraphs, list items, table cells and quoted paragraphs, each with its line and enclosing H2 section): fenced and indented code blocks, inline code, URLs, raw HTML, frontmatter, images and link targets never appear, the visible text of a link does.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
