---
"@concordance-wiki/core": patch
"@concordance-wiki/inference": patch
"@concordance-wiki/plugin-reader-vtt": patch
---

A path segment with no letter or digit left (a name in another script, an emoji) is named after a stable hash instead of an empty slug that made the identifier invalid; the candidates of an ambiguous frontmatter reference are named in identifier order whatever the order of the entities; two cues of a transcript starting at the same instant get distinct anchors (`t-12000`, `t-12000-2`), so that every cue stays addressable.
