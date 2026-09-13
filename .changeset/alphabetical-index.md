---
"@concordance-wiki/site": minor
"@concordance-wiki/cli": minor
---

Alphabetical index segmented by letter: the entries follow the collation of the project locale, which `concordance build` and `concordance render` take from its language pack and pass to the site as `collate` (an `Intl.Collator` of the locale, accents folded and digits by value, when a caller passes none), so that `étude` files between `estimate` and `event`; a letter without an entry is visibly inactive, without a link, and an active letter leads to its anchor in the whole index, whose first entry per letter carries an `anchor`; when the whole index rendered as one page weighs more than 100 kB (`INDEX_SEGMENT_BYTES`), every letter with entries gets `index/<letter>/index.html` (`index/other/index.html` for titles opening with a digit or a symbol), `index/index.html` shows the first of them and every letter page links to its siblings, each page under the budget on a corpus of three thousand notes; the home page links each letter to its place in the index.
