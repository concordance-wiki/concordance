---
"@concordance-wiki/nlp": minor
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
---

Word confidence: every keyword candidate carries a confidence in [0, 1], the product of five signals read from the shape of its distribution in the same pass as the score (spread across the files, occurrences per file, prominence in headings, written links and frontmatter, the company of a defined term, the inflected-form suffixes of the language pack's new optional `suffixes.txt`), with its measures as `signals` and the lowering signals as `penalties`; `inference.keyword_pages.min_confidence` (0.5 by default, validated in [0, 1]) joins `min_occurrences` and `min_files`: an expression under it gets no page nor mark in the text, stays searchable and is recorded as `withheld` in `model.json`; the build summary prints `expressions set aside by confidence`, and every keyword page carries its confidence among its attributes.
