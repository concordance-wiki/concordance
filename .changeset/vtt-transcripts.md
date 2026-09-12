---
"@concordance-wiki/plugin-reader-vtt": minor
"@concordance-wiki/core": minor
---

Readable transcripts: the `reader-vtt` plugin parses VTT and SRT files into cues, speakers, duration and language, renders them as HTML grouped by consecutive speaker with every timecode as an addressable anchor, and returns the spoken text with the character range of every cue. A reader now receives the raw bytes of the file as `payload.bytes`.
