# @concordance-wiki/plugin-convert-libreoffice

Converts `.docx`, `.pptx` and `.xlsx` documents to PDF through headless LibreOffice, so that the site can preview them without the original application. Thumbnails and text indexing are later stories.

## Contribution

One `converter` for the three extensions, producing `pdf`. The manifest declares LibreOffice as a system dependency detected through `soffice --version`: when the command is missing, the registry disables the plugin with a `W-PLUGIN-DISABLED` finding and the documents stay downloadable entities.

## Behaviour

- The cache key is the SHA-256 of the source bytes: the PDF is written to `<cache>/convert/<sha256>.pdf` and an unchanged document is never reconverted, whatever its path.
- The source is copied to a temporary folder under `<cache>/convert/work/<sha256>/` and `soffice --headless --norestore --convert-to pdf` runs there with its own user profile (`-env:UserInstallation`), so that parallel instances do not block each other; the folder is removed afterwards. Nothing is written next to the source.
- A document above `maxSizeBytes` is not converted; a conversion past `timeoutMs` is killed. Both yield a `W-CONV-FAILED` finding, as does a non-zero exit (the message carries the exit code and the first line of stderr) or a run that produces no PDF. The output has no representation in that case: the document remains available for download.
- A source above 100 KiB whose PDF has no extractable text yields a `W-CONV-SUSPECT` finding; the text is read with pdf.js. The finding is reproduced on cache hits so that a second build reports the same anomalies.
- `convertMany(inputs, parallelism, convert)` runs conversions through a small pool and returns the results in input order, whatever the completion order.

## Testing

Unit tests replace LibreOffice with a fake command runner. The integration test runs the installed `soffice` when there is one and is skipped otherwise; every line is covered without it.
