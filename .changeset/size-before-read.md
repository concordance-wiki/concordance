---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": patch
---

A document over `conversion.max_size_mb` is no longer read and hashed before the converter refuses it: the build checks its size first (`size` joins the file system interface) and reports the same `W-CONV-FAILED` without reading a byte.
