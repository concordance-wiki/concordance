# plugins

Official plugins, published under `@concordance-wiki/plugin-*`. Empty so far: the plugin API exists in the core and an example plugin lives under [`fixtures/plugins/example`](../fixtures/plugins/example/index.mjs); this page states what each official plugin will contribute.

| Plugin | Contributes | System dependency |
|---|---|---|
| `reader-vtt` | reader for `.vtt` and `.srt` | none |
| `reader-office` | metadata reader for `.docx`, `.pptx`, `.xlsx`, `.pdf` | none |
| `convert-libreoffice` | converter to PDF, thumbnails and text | LibreOffice |
| `contract-openapi` | source of `endpoint` entities from OpenAPI 3.x | none |
| `contract-wsdl` | source of `endpoint` entities from WSDL | none |
| `viewer-pdf` | UI component: pdf.js viewer and thumbnail rail | none |
| `viewer-swagger` | UI component: Swagger UI and WSDL rendering | none |

A plugin imports `@concordance-wiki/core` and `@concordance-wiki/profile` only. Its integration tests live in its own folder. See the [plugin guide](../docs/guides/plugins.md).
