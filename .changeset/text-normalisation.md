---
"@concordance-wiki/nlp": minor
---

Text normalisation: `comparisonForm` and `comparisonWords` give the form two spellings are compared on (lower-cased, accents stripped, apostrophes unified, each word singularised by the pack's plural rules, hyphens and apostrophes kept inside words), `singularize` applies the first matching suffix rule, and `wordBoundaries` and `isOnWordBoundaries` expose the word positions of a text so that a match is only accepted on word boundaries. The `fr` pack orders `-eaux` before `-aux`, replaces the bare `-x` rule by `-oux` so that invariant words such as "prix" stay as they are, and lowers the `-eux` minimum length so that "jeux" gives "jeu"; both packs stop the `-s` rule on words in `-ss`, so that "address" is stable.
