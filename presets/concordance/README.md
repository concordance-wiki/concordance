# concordance

The unscoped package that integrators install: the `concordance` command (alias `conc`) of [`@concordance-wiki/cli`](../../packages/cli/README.md) together with every official plugin, so that a configuration can declare any of them without installing anything else.

| Dependency | Contributes |
|---|---|
| `@concordance-wiki/cli` | the command line: `build`, `init`, `lint`, `validate-config` |
| `@concordance-wiki/plugin-reader-vtt` | reader for `.vtt` and `.srt` transcripts |
| `@concordance-wiki/plugin-reader-office` | metadata reader for `.docx`, `.pptx`, `.xlsx` and `.pdf` |
| `@concordance-wiki/plugin-convert-libreoffice` | conversion of office documents to PDF; needs LibreOffice on the machine |

The package holds no code of its own: `bin/concordance.js` runs the executable of the command line. The container image `concordancewiki/concordance` is built from this package by the `Dockerfile` at the root of the repository; see the [getting started guide](../../docs/guides/getting-started.md#with-the-container-image).

Part of [Concordance](../../README.md).
