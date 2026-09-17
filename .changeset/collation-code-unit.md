---
"@concordance-wiki/core": minor
"@concordance-wiki/nlp": minor
"@concordance-wiki/site": patch
---

The alphabetical index, the category lists and the dated spaces are ordered by a collation computed from the options of the language pack (`collation` in the core package: accents and case set aside, digits compared by value), never from the collation data of the runtime: two builds on two versions of Node.js order the same titles the same way. A language pack exposes the `collation` options it compares with in place of an `Intl.Collator`.
