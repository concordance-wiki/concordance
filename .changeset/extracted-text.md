---
"@concordance-wiki/cli": minor
"@concordance-wiki/site": minor
"@concordance-wiki/core": minor
"@concordance-wiki/typing": minor
"@concordance-wiki/plugin-convert-libreoffice": minor
"@concordance-wiki/plugin-reader-vtt": minor
---

Extracted text indexed: `concordance build` gains a documents step that reads every file a reader or a converter of the plugins accepts, types it as an entity (identifier with its extension, metadata as attributes, the source rules and their `ext` matches applied), converts office documents to PDF in parallel (`conversion.parallelism`, `convert: false` per source) and takes their text from the pages of that PDF only, so that there is a single extraction path; the `convert-libreoffice` plugin produces a `text` representation (`<sha256>.text.json`, one entry per page) next to every PDF and a second converter keeps `.pdf` sources as their own representation; the `reader-vtt` plugin returns `units`, one per speaker turn with its timecode, a new optional field of `ReaderOutput`; the scan, the keyword discovery and the twin reconciliation read the pages of the documents, an occurrence in a document carrying the page, slide or cue number as its line and its label as its section, so that the mentions panel cites `slide 3` or `00:12:05` instead of a line; a document that still has no markdown representation once the twins are reconciled yields `W-DOC-NOMD`; the fragment of an entity lists its `documents` with the text of every page cut at `build.extracted_text_max_chars` and joined as its `text`, and the build keeps the original file and its PDF under `fragments/<id>/` for `render` to place next to the page; a failed conversion counts for `build.fail_on.unconverted_max`.
