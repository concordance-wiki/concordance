# @concordance-wiki/nlp

Normalisation, Aho-Corasick, n-grams, C-value, MinHash and the language packs.

Today: language packs for `en` and `fr` built from data files (`locales/<locale>/pack.yaml` and `stopwords.txt`), BCP 47 locale resolution with fallback to the language, Unicode word segmentation and collation, a registry for packs shipped by plugins (`loadLanguagePack`, `languagePack`, `registerLanguagePack`, `resolveLocale`, `canonicalLocale`, `loadStopwords`), and text normalisation: the comparison form of a text (lower-cased, accents stripped, apostrophes unified, each word singularised by the pack's suffix rules; `comparisonForm`, `comparisonWords`, `singularize`) and word boundaries from Unicode segmentation (`wordBoundaries`, `isOnWordBoundaries`).

Part of [Concordance](../../README.md).
