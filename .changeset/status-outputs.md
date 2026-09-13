---
"@concordance-wiki/site": patch
"@concordance-wiki/plugin-reader-vtt": patch
---

The count of the filtered related pages and the copied-address notice of the search are `<output>` elements, status regions by nature, instead of spans with a `status` role; the VTT reader leaves the language undefined when the `Language:` header is blank, and keeps an angle bracket that opens no tag in the text of a cue.
