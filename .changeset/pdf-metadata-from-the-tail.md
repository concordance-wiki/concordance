---
"@concordance-wiki/plugin-reader-office": patch
---

The PDF reader no longer turns a whole file into a string to read its metadata: a file over 64 MB is read from its last 16 MB, where an updated file keeps its trailer and its Info object, and gets no page count; a literal string of any length is decoded without spreading its bytes into a call.
