# @concordance-wiki/nlp

Normalisation, Aho-Corasick, n-grams, C-value, MinHash and the language packs.

Today: language packs for `en` and `fr` built from data files (`locales/<locale>/pack.yaml` and `stopwords.txt`), BCP 47 locale resolution with fallback to the language, Unicode word segmentation and collation, and a registry for packs shipped by plugins (`loadLanguagePack`, `languagePack`, `registerLanguagePack`, `resolveLocale`, `canonicalLocale`, `loadStopwords`).

Part of [Concordance](../../README.md).
