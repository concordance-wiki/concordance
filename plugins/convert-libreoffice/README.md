<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/plugin-convert-libreoffice</h1>

<p align="center"><strong>Previews your office documents in the wiki and makes every page of them searchable, through LibreOffice.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/plugin-convert-libreoffice"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/plugin-convert-libreoffice?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/operations.md">Operations</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/plugins/convert-libreoffice/CHANGELOG.md">Changelog</a>
</p>

---

## Why

A document the wiki can only offer for download is a document nobody opens. This plugin turns the `.docx`, `.pptx` and `.xlsx` files of your repositories into PDF through headless LibreOffice, so that the site previews them without the original application, and extracts the text of every page with pdf.js, for `.pdf` sources too. That text is what lets the build recognise the words of your business inside a slide deck and cite the page where they appear. It is carried by [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) and by the container image, LibreOffice included; install it on its own next to [`@concordance-wiki/cli`](https://www.npmjs.com/package/@concordance-wiki/cli), with LibreOffice on the machine that builds.

## Quick start

```bash
npm install --save-dev @concordance-wiki/plugin-convert-libreoffice
```

Then declare it in `concordance.yaml`, and make sure `soffice --version` answers on the build machine:

```yaml
plugins:
  - "@concordance-wiki/plugin-convert-libreoffice"
```

Every office document and PDF of a source gets a PDF representation and the text of its pages, cached by fingerprint; the `conversion` block bounds the work:

```yaml
conversion:
  timeout_s: 120
  max_size_mb: 50
  cache: .concordance-cache
```

A source that must stay downloadable without a preview declares `convert: false`.

## What you get

- **A preview in the page**: the PDF of every document opened in the site's viewer, page by page, with a find box over the extracted text.
- **Every page searchable**: the text of each page goes through the same recognition as a note, so a term cites the page of a deck the way it cites the line of a note.
- **Converted once**: the cache key is the SHA-256 of the source bytes; an unchanged document is never reconverted nor re-read, whatever its path.
- **Bounded work**: `conversion.timeout_s` and `conversion.max_size_mb` cap each conversion; a failure is a `W-CONV-FAILED` finding and the document stays downloadable.
- **Suspect output named**: a large source whose PDF holds no text is a `W-CONV-SUSPECT` finding, reproduced on every build.
- **Graceful without LibreOffice**: LibreOffice is an optional dependency; when `soffice` is missing the build says so once (`W-PLUGIN-DISABLED`, informational), PDF sources are still read, and every office document gets a `W-CONV-FAILED` naming the missing command, downloadable all the same.
- **Nothing written next to a source**: conversions run in a temporary folder under the cache, with their own user profile, in parallel.

## Documentation

- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `conversion` block and `convert: false` on a source
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the converter contribution point
- [Operations](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/operations.md), LibreOffice in the container image and the cache between builds
- [W-CONV-FAILED](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-CONV-FAILED.md) and [W-CONV-SUSPECT](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-CONV-SUSPECT.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/convert-libreoffice/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

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

</details>
