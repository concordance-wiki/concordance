<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/plugin-reader-office</h1>

<p align="center"><strong>Reads what your Word, PowerPoint, Excel and PDF files state about themselves, so every document gets a page.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/plugin-reader-office"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/plugin-reader-office?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md">Plugins</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/plugins/reader-office/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Half of what a team knows sits in office documents next to the markdown, and a wiki that ignores them is half a wiki. This plugin reads the metadata of `.docx`, `.pptx`, `.xlsx` and `.pdf` files in your repositories, title, author, subject, keywords, dates, page, word and slide counts, so that every document gets a page with what the file states about itself, is filed with the notes and shows up in the to-do list when nobody has summarised it. It is carried by [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance); install it on its own next to [`@concordance-wiki/cli`](https://www.npmjs.com/package/@concordance-wiki/cli). No system dependency.

## Quick start

```bash
npm install --save-dev @concordance-wiki/plugin-reader-office
```

Then declare it in `concordance.yaml`, with the conversion plugin next to it when LibreOffice is available, for the preview and the text of every page:

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-office"
  - "@concordance-wiki/plugin-convert-libreoffice"
```

Every `.docx`, `.pptx`, `.xlsx` and `.pdf` file of a source becomes a document entity whose properties come from the file.

## What you get

- **A page per document**, with the properties the file carries: title, author, subject, keywords, creation and modification dates, application.
- **Counts that mean something**: the pages and words an office file declares, the page count of a PDF, the slides of a deck with their titles in order.
- **The document's own dates**, created and modified as the file says, kept apart from the git commit date of the file.
- **Only the bytes**: the reader never touches git, the file system or the clock; a corrupted file is a finding, not a failed build.
- **Twins reconciled**: the build matches a document with the note that describes it, and the page of that note offers the file for download; a document nobody wrote about is listed on the to-do page.
- **Usable alone**: `readOoxml(bytes, kind)` and `readPdf(bytes)` read the two families without the pipeline.

## Documentation

- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the reader contribution point
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), `privacy.pseudonymize` for the authors a file names
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/reader-office/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

`read({ path, payload: { bytes } })` returns `{ metadata, text: "" }`. The text stays empty: extraction belongs to the conversion plugin, which reads it from the PDF. The metadata carries what the file states about itself:

| Property | docx, pptx, xlsx | pdf |
|---|---|---|
| `title`, `author`, `subject`, `keywords` (list) | `docProps/core.xml` | Info dictionary |
| `created`, `modified` (ISO 8601) | `dcterms:created`, `dcterms:modified` | `CreationDate`, `ModDate`, converted from `D:YYYYMMDDHHmmSS` |
| `lastModifiedBy` | `cp:lastModifiedBy` | — |
| `pages`, `words` | `docProps/app.xml` | `pages`: number of page objects; a PDF over 64 MB is read from its last 16 MB alone, where an updated file keeps its trailer and its Info object, and gets no page count |
| `slides`, `slideTitles` | pptx only: `Slides` and the title placeholder of every `ppt/slides/slideN.xml`, in slide order; an empty string when a slide has no title | — |
| `application` | `docProps/app.xml` | — |

An absent property is absent from the record. A package without `docProps` yields empty metadata; a corrupted archive, a file without the PDF header or an unknown extension throws a plain error naming the file, which the pipeline turns into a finding.

The dates are the document's own and are kept apart from the git commit date the ingested file carries: the reader reads nothing but the bytes it is given, never git, the file system or the clock. Authors are returned raw; pseudonymisation applies downstream, on the model, when it is enabled.

PDF objects stored in compressed object streams are not scanned: the page count is then a lower bound and an Info dictionary hidden there is not seen. The conversion plugin, which parses the whole PDF for its text, does not depend on that count.

</details>
