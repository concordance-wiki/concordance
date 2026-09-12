# @concordance-wiki/nlp

Normalisation, Aho-Corasick, n-grams, C-value, MinHash and the language packs.

Today: `languagePack(locale)` returns the `en` or `fr` pack shipped with the core, each with `normalize` (lower-case, accents stripped, apostrophes unified, whitespace collapsed), a default `stopwords` set read from `locales/<locale>/stopwords.txt`, the `typePrefixes` of the default profile and a `collator` (accent-insensitive, numeric) behind `compare`. `resolveLocale` applies the fallback chain of a source (source, then project, then `en`), `availableLocales` lists the registered packs and `registerLanguagePack` lets a plugin add a locale the core does not ship. `loadStopwords` parses a stopword file (one word per line, `#` comments) into a sorted list of unique lowercase words. Plural rules, word boundaries and the occurrence scan are not there yet.

Part of [Concordance](../../README.md).
