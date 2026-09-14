# @concordance-wiki/plugin-reader-office

A reader plugin for Concordance that reads the metadata of Word, PowerPoint, Excel and PDF files, title, author, subject, keywords, dates, page, word and slide counts, so that a document of a repository gets a page with what the file states about itself. An integrator installs it with `@concordance-wiki/concordance`, which carries it, or next to `@concordance-wiki/cli`, and declares it in `concordance.yaml`; no system dependency.

## Install

```bash
npm install --save-dev @concordance-wiki/plugin-reader-office
```

Then declare it in `concordance.yaml`:

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-office"
```

## Use

With the plugin declared, every `.docx`, `.pptx`, `.xlsx` and `.pdf` file of a source becomes a document entity whose properties come from the file; the text of its pages comes from the conversion plugin, declared next to it when LibreOffice is available:

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-office"
  - "@concordance-wiki/plugin-convert-libreoffice"
```

## What it contains

- The plugin manifest, as the default export: one `reader` contribution for `.docx`, `.pptx`, `.xlsx` and `.pdf`.
- `read`: `{ path, payload: { bytes } }` to `{ metadata, text: "" }`, the metadata as the table below.
- `readOoxml(bytes, kind)`, `readPdf(bytes)`, `isoDate`: the readers of the two families and the date conversion, usable on their own.
- `extensions`, `OfficeMetadata`: the extensions read and the shape of the record.

## Documentation

- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the reader contribution point
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), `privacy.pseudonymize` for the authors a file names
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/reader-office/CHANGELOG.md)

## Inside

`read({ path, payload: { bytes } })` returns `{ metadata, text: "" }`. The text stays empty: extraction belongs to the conversion plugin, which reads it from the PDF. The metadata carries what the file states about itself:

| Property | docx, pptx, xlsx | pdf |
|---|---|---|
| `title`, `author`, `subject`, `keywords` (list) | `docProps/core.xml` | Info dictionary |
| `created`, `modified` (ISO 8601) | `dcterms:created`, `dcterms:modified` | `CreationDate`, `ModDate`, converted from `D:YYYYMMDDHHmmSS` |
| `lastModifiedBy` | `cp:lastModifiedBy` | — |
| `pages`, `words` | `docProps/app.xml` | `pages`: number of page objects |
| `slides`, `slideTitles` | pptx only: `Slides` and the title placeholder of every `ppt/slides/slideN.xml`, in slide order; an empty string when a slide has no title | — |
| `application` | `docProps/app.xml` | — |

An absent property is absent from the record. A package without `docProps` yields empty metadata; a corrupted archive, a file without the PDF header or an unknown extension throws a plain error naming the file, which the pipeline turns into a finding.

The dates are the document's own and are kept apart from the git commit date the ingested file carries: the reader reads nothing but the bytes it is given, never git, the file system or the clock. Authors are returned raw; pseudonymisation applies downstream, on the model, when it is enabled.

PDF objects stored in compressed object streams are not scanned: the page count is then a lower bound and an Info dictionary hidden there is not seen. The conversion plugin, which parses the whole PDF for its text, does not depend on that count.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
