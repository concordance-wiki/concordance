---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/plugin-reader-vtt": minor
---

Pseudonymisation is applied by the build: the dictionary of `privacy.pseudonymize` is read and validated (`W-PRIVACY-DICTIONARY` when it is missing or malformed, an error that fails the build and withholds every transcript when pseudonymisation is enabled), every transcript is pseudonymised before typing in its cues, its metadata and the file offered for download, which readers write back through a new optional `rewrite` (implemented for VTT and SRT; `W-PRIVACY-WITHHELD` for a reader without it), the notes and documents of the scope types are replaced the same way, the real names are rejected from keyword discovery, and transcripts are withheld altogether unless `privacy.publish_transcripts` is true.
