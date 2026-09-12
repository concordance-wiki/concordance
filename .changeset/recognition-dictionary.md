---
"@concordance-wiki/nlp": minor
---

Recognition dictionary: `buildDictionary` keys every title and alias of the entities of a locale by comparison form, orders the targets of a form with glossary sources first, leaves out stopwords and terms shorter than three characters unless `inference.short_terms` allows them, and flags a form shared by several entities as a homonym with an `I-TERM-HOMONYM` finding; `dictionaryStopwords` merges the pack's default stopwords with the files listed under `inference.stopwords`, and `glossarySources` names the priority sources from `inference.glossary_sources` or the `glossary: true` marks.
