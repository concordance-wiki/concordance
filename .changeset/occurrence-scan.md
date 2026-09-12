---
"@concordance-wiki/nlp": minor
---

Occurrence scan: `tokenize` cuts a text into words in comparison form with their character spans; `buildAutomaton`, `scan` and `longestMatches` run a word-level Aho-Corasick automaton in one pass per text and keep the longest expression on overlap; `scanDocument` builds the automaton once per dictionary and emits, for every mention in the paragraphs of a document, one occurrence per target with file, line, position, section, an 80-character centred context, the type announced by a recognised prefix (`type_prefixes`, plus the `type_prefix_bonus`) and a confidence halved for homonyms; `occurrenceConfidence` gives the per-occurrence increments up to the cap and `compareOccurrences` the canonical order.
