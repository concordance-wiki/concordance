---
"@concordance-wiki/plugin-convert-libreoffice": minor
"@concordance-wiki/core": minor
---

Add the `convert-libreoffice` plugin: `.docx`, `.pptx` and `.xlsx` documents are converted to PDF through headless LibreOffice, cached by the SHA-256 of the source under the pipeline cache, run through a bounded pool that keeps the input order, with `W-CONV-FAILED` on size, timeout or failure and `W-CONV-SUSPECT` on a large document whose PDF has no extractable text. The core types the converter payload (`bytes`, `sha256`, `cacheDirectory`, limits) and output (`representations` as cache files plus `findings`), and `FileSystem` gains `writeBytes` and `remove`.
