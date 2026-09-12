# plugins

Official plugins, published under `@concordance-wiki/plugin-*`. An example plugin lives under [`fixtures/plugins/example`](../fixtures/plugins/example/index.mjs); this page states what each official plugin contributes, or will.

| Plugin | Contributes | System dependency | Status |
|---|---|---|---|
| [`reader-vtt`](reader-vtt/README.md) | reader for `.vtt` and `.srt`: cues, speakers, duration, language, HTML rendering with addressable timecodes | none | available |
| [`reader-office`](reader-office/README.md) | metadata reader for `.docx`, `.pptx`, `.xlsx`, `.pdf`: title, author, subject, keywords, dates, page, word and slide counts, slide titles | none | available |
| [`convert-libreoffice`](convert-libreoffice/README.md) | converter of `.docx`, `.pptx`, `.xlsx` to PDF with a fingerprint cache; thumbnails and text later | LibreOffice | available |
| `contract-openapi` | source of `endpoint` entities from OpenAPI 3.x | none | planned |
| `contract-wsdl` | source of `endpoint` entities from WSDL | none | planned |
| `viewer-pdf` | UI component: pdf.js viewer and thumbnail rail | none | planned |
| `viewer-swagger` | UI component: Swagger UI and WSDL rendering | none | planned |

A plugin imports `@concordance-wiki/core` and `@concordance-wiki/profile` only, plus the libraries of its format. It follows the layout of a core package (`src/` compiled to `dist/`, `test/` run by Vitest against the sources, 100% coverage) and its integration tests live in its own folder, skipped when the system dependency is absent. See the [plugin guide](../docs/guides/plugins.md).
