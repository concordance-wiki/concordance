# @concordance-wiki/plugin-convert-libreoffice

Converts `.docx`, `.pptx` and `.xlsx` documents to PDF through headless LibreOffice, so that the site can preview them without the original application, and extracts the text of every page of the PDF with pdf.js: the single extraction path of the tool, which a `.pdf` source takes too. Thumbnails are a later story.

## Contribution

Two `converter` contributions, both producing `pdf` and `text`: one for the three office extensions, one for `.pdf`, whose sources are kept as their own PDF representation without running LibreOffice. The manifest declares LibreOffice as a system dependency detected through `soffice --version`: when the command is missing, the registry disables the plugin with a `W-PLUGIN-DISABLED` finding and the documents stay downloadable entities, PDF sources included.

## Behaviour

- The cache key is the SHA-256 of the source bytes: the PDF is written to `<cache>/convert/<sha256>.pdf`, the text of its pages next to it as `<sha256>.text.json` (`{ "pages": string[] }`, one entry per page), and an unchanged document is never reconverted nor re-read, whatever its path. A cache of a previous version holding the PDF alone gets its text extracted once.
- The source is copied to a temporary folder under `<cache>/convert/work/<sha256>/` and `soffice --headless --norestore --convert-to pdf` runs there with its own user profile (`-env:UserInstallation`), so that parallel instances do not block each other; the folder is removed afterwards. Nothing is written next to the source.
- A document above `maxSizeBytes` is not converted; a conversion past `timeoutMs` is killed. Both yield a `W-CONV-FAILED` finding, as does a non-zero exit (the message carries the exit code and the first line of stderr) or a run that produces no PDF. The output has no representation in that case: the document remains available for download.
- A source above 100 KiB whose PDF has no extractable text yields a `W-CONV-SUSPECT` finding. The finding is reproduced on cache hits so that a second build reports the same anomalies.
- `extractPdfPages(bytes)` gives the text of every page in reading order, the items of a page joined by spaces, and no page for bytes that are not a PDF; `extractPdfText` joins them, one line per page.
- `convertMany(inputs, parallelism, convert)` runs conversions through a small pool and returns the results in input order, whatever the completion order.

## Testing

Unit tests replace LibreOffice with a fake command runner. The integration test runs the installed `soffice` only when `CONCORDANCE_INTEGRATION=1` is set (the pipeline sets it) and there is one; it is skipped otherwise, and every line is covered without it.
