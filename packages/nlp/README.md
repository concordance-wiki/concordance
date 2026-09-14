# @concordance-wiki/nlp

The text processing of Concordance: the language packs (`en`, `fr`), the comparison form of a text, the recognition dictionary of the titles and aliases of a wiki, the word-level Aho-Corasick scan that finds them in every note, and the keyword discovery that scores the expressions no note defines yet. Installed by `@concordance-wiki/cli`; you need it only to build on the engine, to register a language pack from a plugin for instance.

## Install

```bash
npm install @concordance-wiki/nlp
```

## Use

The dictionary of a two-note wiki and the scan of one paragraph, the way `concordance build` recognises the words of a note:

```ts
import { buildDictionary, comparisonForm, languagePack, scanDocument } from "@concordance-wiki/nlp";

const pack = languagePack("en");
comparisonForm("Occurrence Scans", pack); // "occurrence scan"
const entities = [
  { id: "glossary/occurrence-scan", source: "glossary", type: "term", title: "Occurrence scan", aliases: ["scan"], locale: "en" },
  { id: "glossary/finding", source: "glossary", type: "term", title: "Finding", aliases: [], locale: "en" },
];
const dictionary = buildDictionary({ entities, locale: "en", glossarySources: new Set(["glossary"]), stopwords: pack.stopwords, shortTerms: new Set() });
const document = { path: "checks/link-broken.md", paragraphs: [{ line: 5, text: "The occurrence scan reports a finding per broken link." }] };
const scale = { base: 0.6, per_occurrence: 0.05, cap: 0.8, homonym_factor: 0.5, type_prefix_bonus: 0.1 };
scanDocument({ document, source: "specs", dictionary, pack, typePrefixes: {}, scale }).map((o) => o.target.id);
// ["glossary/occurrence-scan", "glossary/finding"]
```

## What it contains

- `languagePack`, `loadLanguagePack`, `registerLanguagePack`, `resolveLocale`, `canonicalLocale`, `availableLocales`, `loadStopwords`, `loadSuffixes`: the packs built from `locales/<locale>/` and the registry a plugin adds a language to.
- `comparisonForm`, `comparisonWords`, `singularize`, `wordBoundaries`, `isOnWordBoundaries`, `searchTokens`: text normalisation, Unicode segmentation and the tokens of the search index.
- `buildDictionary`, `dictionaryStopwords`, `glossarySources`: the recognition dictionary keyed by comparison form, glossary sources first, homonyms flagged with `I-TERM-HOMONYM`.
- `tokenize`, `buildAutomaton`, `scan`, `longestMatches`, `scanDocument`, `occurrenceConfidence`, `compareOccurrences`: the occurrence scan, one pass per text, each occurrence with its file, line, position, section, context, type prefix and confidence.
- `extractNgrams`, `scoreCandidates`, `confidenceOf`, `undefinedTermFindings`, `similarExpressions`, `definedExpressions`: the keyword discovery, C-value × IDF over one- to four-word n-grams, the confidence of each candidate and the `W-TERM-UNDEFINED` findings.
- `publishKeywords`, `keywordEntities`, `keywordOptions`, `keywordPublicationOptions`: the keyword pages the site publishes, the expressions discarded or withheld, and the `term` entities marked `keyword: true`.

## Documentation

- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `inference` block
- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md)
- [Limits](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/limits.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/nlp/CHANGELOG.md)

## Inside

Language packs for `en` and `fr` built from data files (`locales/<locale>/pack.yaml`, `stopwords.txt` and the optional `suffixes.txt` of inflected-form endings; the default stopwords are the words that name nothing on their own in any corpus, from the articles to every form of the auxiliaries and light verbs, the adverbs of prose, quantifiers, numerals, time words and the nouns that only count or place, never a word that could be a business term or end a technical compound, which a project lists under `inference.stopwords`), BCP 47 locale resolution with fallback to the language, Unicode word segmentation and collation, a registry for packs shipped by plugins (`loadLanguagePack`, `languagePack`, `registerLanguagePack`, `resolveLocale`, `canonicalLocale`, `loadStopwords`), and text normalisation: the comparison form of a text (lower-cased, accents stripped, apostrophes unified, each word singularised by the pack's suffix rules; `comparisonForm`, `comparisonWords`, `singularize`) and word boundaries from Unicode segmentation (`wordBoundaries`, `isOnWordBoundaries`); and the recognition dictionary: `buildDictionary` keys every title and alias of the entities of a locale by comparison form, with priority to glossary sources (`glossarySources`), leaves out stopwords (`dictionaryStopwords` merges the pack's defaults with the files of `inference.stopwords`) and terms shorter than three characters unless `inference.short_terms` allows them, and flags the forms shared by several entities as homonyms with an `I-TERM-HOMONYM` finding; and the occurrence scan: `tokenize` cuts a text into words in comparison form with their spans, `buildAutomaton`, `scan` and `longestMatches` run a word-level Aho-Corasick over them (one pass per text; an expression contained in a longer recognised one is dropped, while expressions that only partly overlap are all kept), and `scanDocument` turns the matches of a dictionary in the paragraphs of a document into occurrences with file, line, position, the matched text as written, section, an 80-character context, the type announced by a recognised prefix (`type_prefixes`) and a confidence from the `glossary_occurrence` scale (`occurrenceConfidence` gives the per-occurrence increments up to the cap; `compareOccurrences` is their canonical order). The scan reads the units that `scannableText` of the ingestion package produces, so code blocks, inline code, URLs, frontmatter and link targets never yield an occurrence; the visible text of a link does. And the keyword discovery: `extractNgrams` reads the same units and yields every n-gram of one to four words (`keywordOptions` resolves `inference.ngrams`, `inference.candidate_score` and the lock's `rejected_terms`), leaving out those starting or ending with a stopword, made only of digits or shorter than three characters, each with its surface form, position and a 160-character context; `scoreCandidates` groups them by comparison form, drops the dictionary entries and the rejected terms (which still penalise the n-grams they contain), scores each candidate by C-value × IDF and keeps those with three occurrences in two distinct files, best score first with its display form and its mentions (`compareMentions`), each with its confidence in [0, 1] of being a term of the subject rather than a word of the language, the product of five signals rounded to four decimals (`confidenceOf`, `confidenceFactors`, `confidencePenalties`, the measures in `signals` and the lowering signals in `penalties`): spread `df / N`, 1 up to `maxSpread` (0.5) then linear down to 0 for a word in every file, read only in a corpus of `SPREAD_MIN_FILES` (10); burst `occurrences / df`, 1 from `BURST_PER_FILE` (1.5) else `0.5 + (burst − 1)`, read only from `BURST_MIN_FILES` (5); position `POSITION_BASE` (0.8) plus 0.2 times the share of appearances in the prominent texts given as `prominent` n-grams (headings, written links, frontmatter), capped at one; neighbourhood 1 when the expression is, or is a component of, a frequent n-gram that also holds a defined term, `NEIGHBOURHOOD_BASE` (0.9) otherwise; morphology `MORPHOLOGY_PENALTY` (0.8) when a word ends with an inflected-form suffix of the pack (`suffixes.txt`, `loadSuffixes`; a pack without the file penalises no form), 1 otherwise; `undefinedTermFindings` turns the candidates at or above the score threshold into `W-TERM-UNDEFINED` findings; `similarExpressions` picks, among keyed expressions, those of a similar form to a key (`similarForm`: one a contiguous part of the other, or half the distinct words of the longer one shared), the closest first, five at most (`SIMILAR_EXPRESSIONS_LIMIT`), for the leads of a keyword page; `definedExpressions` lists the n-grams the dictionary already defines that reach the publication threshold, the expressions whose keyword page a note took over. And the publication threshold: `publishKeywords` splits the candidates into the pages to generate (`keywords/<slug of the key>`, sorted by identifier; two keys with the same slug take numeric suffixes in score order), the expressions discarded by the counts of `inference.keyword_pages` (`keywordPublicationOptions`: three occurrences in two distinct files by default) and those withheld by its `min_confidence` (one half by default), both staying in the output for the search index without a page; `keywordEntities` turns each page into a `term` entity marked `keyword: true`, located on the first mention of its expression, with its occurrences, files, score and confidence as attributes. The counts of the three lists go into the build summary (`keywords.published`, `keywords.discarded`, `keywords.withheld` in core's `summarize`), printed by the build as `keyword pages`, `expressions under the threshold` and `expressions set aside by confidence` once the build runs the discovery.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
