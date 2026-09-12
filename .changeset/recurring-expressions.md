---
"@concordance-wiki/nlp": minor
---

Recurring unreferenced expressions: `extractNgrams` yields the n-grams of one to four words of the text units of notes and documents, minus those starting or ending with a stopword, made only of digits or shorter than three characters, each with its surface form, position and context; `scoreCandidates` groups them by comparison form, leaves out the dictionary entries and the lock's `rejected_terms`, scores each candidate by C-value × IDF (an n-gram nested in a longer, more frequent one is penalised) and keeps those with three occurrences in two distinct files; `undefinedTermFindings` reports the candidates at or above `inference.candidate_score` as `W-TERM-UNDEFINED`, and `keywordOptions` reads every threshold from the configuration and the lock.
