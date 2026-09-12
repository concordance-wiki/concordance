# @concordance-wiki/plugin-reader-office

Metadata reader for Word, PowerPoint, Excel and PDF files. Contributes one `reader` for `.docx`, `.pptx`, `.xlsx` and `.pdf`; no system dependency.

`read({ path, payload: { bytes } })` returns `{ metadata, text: "" }`. The text stays empty: extraction belongs to the conversion story. The metadata carries what the file states about itself:

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

PDF objects stored in compressed object streams are not scanned: the page count is then a lower bound and an Info dictionary hidden there is not seen. The text extraction story brings a full parser.

Exports: the default plugin manifest, `read`, `extensions`, `readOoxml(bytes, kind)`, `readPdf(bytes)`, `isoDate` and the `OfficeMetadata` type.

Part of [Concordance](../../README.md); see the [plugin guide](../../docs/guides/plugins.md).
