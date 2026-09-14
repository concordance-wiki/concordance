---
"@concordance-wiki/nlp": minor
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/site": minor
"@concordance-wiki/i18n": minor
---

Word confidence: every keyword candidate carries a confidence in [0, 1], the product of five signals read from the shape of its distribution in the same pass as the score (spread across the files, occurrences per file, prominence in headings, written links and frontmatter, the company of a defined term, the inflected-form suffixes of the language pack's new optional `suffixes.txt`), with its measures as `signals` and the lowering signals as `penalties`; `inference.keyword_pages.min_confidence` (0.5 by default, validated in [0, 1]) joins `min_occurrences` and `min_files`: an expression under it gets no page nor mark in the text, stays searchable and is recorded as `withheld` in `model.json`; the build summary prints `expressions set aside by confidence`, and every keyword page carries its confidence among its attributes. The to-do page lists the words a hundred at a time, the others behind a "Show the N others" disclosure served in the HTML, and folds a third section, "Suspected noise", listing the withheld expressions best score first with their counts and their reason worded in the language of the site ("in 68% of the files, 1.2 per file, verb or adverb form"), none linked, with a call to add them to the project's stopwords leading to `project.contribute_url`.
