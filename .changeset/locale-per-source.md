---
"@concordance-wiki/nlp": minor
---

Language packs per locale: `languagePack` returns the `en` or `fr` pack (normalisation, default stopwords read from `locales/<locale>/stopwords.txt`, type prefixes of the default profile, accent-insensitive numeric collation), `resolveLocale` applies the source, project, `en` fallback chain, `registerLanguagePack` and `availableLocales` let plugins add locales, and `loadStopwords` parses a stopword file. The locale ingestion records on every source is what the entities will carry.
