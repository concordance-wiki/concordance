# @concordance-wiki/nlp

Normalisation, Aho-Corasick, n-grams, C-value, MinHash and the language packs.

Today: language packs for `en` and `fr` built from data files (`locales/<locale>/pack.yaml` and `stopwords.txt`), BCP 47 locale resolution with fallback to the language, Unicode word segmentation and collation, a registry for packs shipped by plugins (`loadLanguagePack`, `languagePack`, `registerLanguagePack`, `resolveLocale`, `canonicalLocale`, `loadStopwords`), and text normalisation: the comparison form of a text (lower-cased, accents stripped, apostrophes unified, each word singularised by the pack's suffix rules; `comparisonForm`, `comparisonWords`, `singularize`) and word boundaries from Unicode segmentation (`wordBoundaries`, `isOnWordBoundaries`); and the recognition dictionary: `buildDictionary` keys every title and alias of the entities of a locale by comparison form, with priority to glossary sources (`glossarySources`), leaves out stopwords (`dictionaryStopwords` merges the pack's defaults with the files of `inference.stopwords`) and terms shorter than three characters unless `inference.short_terms` allows them, and flags the forms shared by several entities as homonyms with an `I-TERM-HOMONYM` finding.

Part of [Concordance](../../README.md).
