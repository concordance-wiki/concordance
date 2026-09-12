---
"@concordance-wiki/inference": minor
"@concordance-wiki/core": minor
"@concordance-wiki/checks": minor
---

Links written in notes: `explicitLinks` turns every markdown link that resolves to a note into a link at the `explicit_link` confidence with the file, line, text and anchor as provenance, attaches a non-markdown target as a `documents` link from the resource, reports a missing target as `E-LINK-BROKEN`, and resolves `<source>:<path>` links and relative links climbing into a sibling source only when `inference.cross_source_links` is set, flagging them as `W-LINK-CROSS-SOURCE` otherwise; core gains the `Link` and `Provenance` types mirroring the model schema, and the checks catalogue registers `W-LINK-CROSS-SOURCE`.
