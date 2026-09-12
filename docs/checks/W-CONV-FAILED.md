# W-CONV-FAILED

**Severity:** warning. **Family:** documents.

An office document could not be converted to PDF.

Timeout, size above `conversion.max_size_mb`, a corrupted file, or a missing converter. The document stays in the site as a downloadable entity with its metadata, without preview and without extracted text.

## Before

```
meetings/2026-03-12/support.pptx  (180 MB, conversion timed out after 120 s)
```

## After

```
meetings/2026-03-12/support.pptx  (12 MB, converted in 6 s)
```

## How to fix

Check that the file opens, reduce its size, or raise `conversion.timeout_s` and `conversion.max_size_mb`. If the converter is missing, install LibreOffice in the build image.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
