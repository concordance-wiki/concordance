---
"@concordance-wiki/nlp": minor
"@concordance-wiki/core": minor
---

Language packs are data: a `pack.yaml` validated by the published `language-pack.schema.json` plus a stopword list, loaded the same way for the shipped `en` and `fr` packs and for packs shipped by plugins. Locales are BCP 47 tags resolved to their language; the platform provides word segmentation and collation.
