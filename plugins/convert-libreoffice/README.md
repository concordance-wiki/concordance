# @concordance-wiki/plugin-convert-libreoffice

A converter plugin for Concordance that turns `.docx`, `.pptx` and `.xlsx` documents into PDF through headless LibreOffice, so that the site can preview them without the original application, and extracts the text of every page of the PDF with pdf.js, the single extraction path of the tool, which a `.pdf` source takes too. An integrator installs it with `@concordance-wiki/concordance`, which carries it, or next to `@concordance-wiki/cli`, and declares it in `concordance.yaml`; LibreOffice must be on the machine that builds.

## Install

```bash
npm install --save-dev @concordance-wiki/plugin-convert-libreoffice
```

Then declare it in `concordance.yaml`, and make sure `soffice --version` answers on the build machine:

```yaml
plugins:
  - "@concordance-wiki/plugin-convert-libreoffice"
```

## Use

With the plugin declared, every office document and PDF of a source gets a PDF representation and the text of its pages, cached by fingerprint; the `conversion` block bounds the work:

```yaml
conversion:
  timeout_s: 120
  max_size_mb: 50
  cache: .concordance-cache
```

A source that must stay downloadable without a preview declares `convert: false`. When LibreOffice is missing, the plugin is disabled with a `W-PLUGIN-DISABLED` finding and the documents stay downloadable entities, PDF sources included.

## What it contains

- The plugin manifest, as the default export: two `converter` contributions producing `pdf` and `text`, one for `.docx`, `.pptx` and `.xlsx`, one for `.pdf`, and LibreOffice as a system dependency detected through `soffice --version`.
- `createConverter`, `createPdfConverter`, `convertToPdf`: the conversions, over an injected command runner and file system.
- `extractPdfPages`, `extractPdfText`: the text of every page of a PDF, in reading order.
- `convertMany`: a small pool that runs conversions in parallel and returns the results in input order.
- `sha256Of`, `extractedTextPath`, `OFFICE_EXTENSIONS`, `PDF_EXTENSION`, `SOFFICE`, `SUSPECT_SOURCE_BYTES`: the cache key, the text file next to the PDF and the constants of the plugin.

## Documentation

- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `conversion` block and `convert: false` on a source
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the converter contribution point
- [Operations](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/operations.md), LibreOffice in the container image and the cache between builds
- [W-CONV-FAILED](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-CONV-FAILED.md) and [W-CONV-SUSPECT](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-CONV-SUSPECT.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/convert-libreoffice/CHANGELOG.md)

## Inside

### Contribution

Two `converter` contributions, both producing `pdf` and `text`: one for the three office extensions, one for `.pdf`, whose sources are kept as their own PDF representation without running LibreOffice. The manifest declares LibreOffice as a system dependency detected through `soffice --version`: when the command is missing, the registry disables the plugin with a `W-PLUGIN-DISABLED` finding and the documents stay downloadable entities, PDF sources included. Thumbnails are a later story.

### Behaviour

- The cache key is the SHA-256 of the source bytes: the PDF is written to `<cache>/convert/<sha256>.pdf`, the text of its pages next to it as `<sha256>.text.json` (`{ "pages": string[] }`, one entry per page), and an unchanged document is never reconverted nor re-read, whatever its path. A cache of a previous version holding the PDF alone gets its text extracted once.
- The source is copied to a temporary folder under `<cache>/convert/work/<sha256>/` and `soffice --headless --norestore --convert-to pdf` runs there with its own user profile (`-env:UserInstallation`), so that parallel instances do not block each other; the folder is removed afterwards. Nothing is written next to the source.
- A document above `maxSizeBytes` is not converted; a conversion past `timeoutMs` is killed. Both yield a `W-CONV-FAILED` finding, as does a non-zero exit (the message carries the exit code and the first line of stderr) or a run that produces no PDF. The output has no representation in that case: the document remains available for download.
- A source above 100 KiB whose PDF has no extractable text yields a `W-CONV-SUSPECT` finding. The finding is reproduced on cache hits so that a second build reports the same anomalies.
- `extractPdfPages(bytes)` gives the text of every page in reading order, the items of a page joined by spaces, and no page for bytes that are not a PDF; `extractPdfText` joins them, one line per page.
- `convertMany(inputs, parallelism, convert)` runs conversions through a small pool and returns the results in input order, whatever the completion order.

### Testing

Unit tests replace LibreOffice with a fake command runner. The integration test runs the installed `soffice` only when `CONCORDANCE_INTEGRATION=1` is set (the pipeline sets it) and there is one; it is skipped otherwise, and every line is covered without it.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
