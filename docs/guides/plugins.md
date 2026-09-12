# Plugins

The core of Concordance reads markdown and produces JSON. It depends on no office format and no system tool. Everything else is a plugin: format readers, the LibreOffice converter, contract importers, viewers, and later heavy projections and extra languages.

## Official plugins

| Package | Contributes | System dependency |
|---|---|---|
| `@concordance-wiki/plugin-reader-vtt` | reader for `.vtt` and `.srt` transcripts | none |
| `@concordance-wiki/plugin-reader-office` | metadata reader for `.docx`, `.pptx`, `.xlsx`, `.pdf` | none |
| `@concordance-wiki/plugin-convert-libreoffice` | converter to PDF, thumbnails, text extraction | LibreOffice |
| `@concordance-wiki/plugin-contract-openapi` | source of `endpoint` entities from OpenAPI 3.x | none |
| `@concordance-wiki/plugin-contract-wsdl` | source of `endpoint` entities from WSDL | none |
| `@concordance-wiki/plugin-viewer-pdf` | UI component: pdf.js viewer, thumbnail rail | none |
| `@concordance-wiki/plugin-viewer-swagger` | UI component: Swagger UI and WSDL rendering | none |

The `concordance` preset depends on all of them. Install the core packages alone when you want a build without any of this.

## Declaring plugins

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - name: "@concordance-wiki/plugin-convert-libreoffice"
    options: { timeout_s: 120 }
```

Plugins load in the declared order and register in a deterministic registry. A plugin whose declared system dependency is missing disables itself with a finding; the build continues. A plugin whose `apiVersion` is incompatible with the installed core is a configuration error.

## Writing a plugin

A plugin is a package that exports a `definePlugin` call returning a manifest validated by [`schemas/plugin.schema.json`](../../schemas/plugin.schema.json).

```ts
import { definePlugin } from "@concordance-wiki/core";

export default definePlugin({
  name: "@example/plugin-reader-csv",
  version: "0.1.0",
  apiVersion: "1",
  systemDependencies: [],
  contributes: {
    readers: [{ extensions: [".csv"], read: readCsv }],
  },
});
```

### Contribution points

| Point | Signature | Used by |
|---|---|---|
| `reader` | `(file, context) → resource` : metadata and text for an extension | ingestion |
| `converter` | `(resource, cache) → representations` : previews and extracted text | conversion |
| `source` | `(declaration, context) → entities[]` : entities from something that is not a markdown file, such as a contract | ingestion |
| `inference method` | `(model, texts) → links[]` with a method name and a confidence from the profile | inference |
| `check` | `(model) → findings[]` with an identifier, a default severity, a description, a remediation and a documentation URL | checks, linter |
| `projection` | `(model) → { html, json }` : a view of the model | rendering |
| `ui component` | a slot name and a client bundle loaded on demand | site |

Every contribution is a pure function of its inputs plus the injected context (file system, fetcher, cache, clock). A plugin never writes into a source repository. Checks contributed by a plugin obey the same identifier convention (`E-`, `W-`, `I-`) and need a documentation page.

### Versioning

The plugin API is versioned from the first release. A core release that changes the API bumps `apiVersion`; a plugin declares the versions it supports. Official plugins are released together with the core through Changesets.
