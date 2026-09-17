---
"@concordance-wiki/ingest": patch
"@concordance-wiki/plugin-convert-libreoffice": patch
---

A git source is reported unreachable only when git fails: a failure of the file system while listing or dating its files surfaces as the bug it is; two identical office documents under two paths converted in parallel share one LibreOffice run instead of one work folder, so that neither loses its PDF.
