export { LanguagePackError, loadLanguagePack } from "./locale/load-pack.js";
export type { LanguagePack, PluralRule, Word } from "./locale/pack.js";
export {
  availableLocales,
  languagePack,
  registerLanguagePack,
  resolveLocale,
} from "./locale/registry.js";
export { canonicalLocale } from "./locale/tag.js";
export { loadStopwords } from "./locale/stopwords.js";
export { isOnWordBoundaries, wordBoundaries, type WordBoundary } from "./text/boundaries.js";
export { comparisonForm, comparisonWords } from "./text/comparison-form.js";
export { searchTokens } from "./text/search-tokens.js";
export { singularize } from "./text/singular.js";
export { buildDictionary, HOMONYM_CHECK, type BuildDictionaryInput } from "./dictionary/build.js";
export {
  dictionaryStopwords,
  glossarySources,
  type DictionaryStopwordsInput,
} from "./dictionary/stopwords.js";
export type {
  Dictionary,
  DictionaryEntry,
  DictionarySource,
  DictionaryTarget,
} from "./dictionary/types.js";
export {
  buildAutomaton,
  longestMatches,
  scan,
  type Automaton,
  type AutomatonState,
  type Pattern,
  type RawMatch,
} from "./scan/automaton.js";
export { tokenize, type Token } from "./scan/tokens.js";
export {
  compareOccurrences,
  occurrenceConfidence,
  scanDocument,
  type Occurrence,
  type OccurrenceScale,
  type ScanDocumentInput,
  type ScannedDocument,
  type ScannedParagraph,
} from "./scan/occurrences.js";
export {
  extractNgrams,
  keywordForm,
  keywordForms,
  type ExtractNgramsOptions,
  type KeywordUnit,
  type NgramOccurrence,
} from "./keywords/ngrams.js";
export {
  compareMentions,
  scoreCandidates,
  type KeywordCandidate,
  type KeywordMention,
  type ScoreCandidatesOptions,
} from "./keywords/score.js";
export {
  UNDEFINED_TERM_CHECK,
  undefinedTermFindings,
  type UndefinedTermOptions,
} from "./keywords/findings.js";
export {
  keywordDefaults,
  keywordOptions,
  type KeywordLock,
  type KeywordOptions,
} from "./keywords/options.js";
export {
  SIMILAR_EXPRESSIONS_LIMIT,
  similarExpressions,
  similarForm,
  type KeyedExpression,
} from "./keywords/similar.js";
export {
  definedExpressions,
  type DefinedExpression,
  type DefinedExpressionsOptions,
} from "./keywords/defined.js";
export {
  KEYWORD_TYPE,
  keywordEntities,
  keywordPublicationDefaults,
  keywordPublicationOptions,
  publishKeywords,
  type KeywordEntitiesOptions,
  type KeywordPage,
  type KeywordPublicationOptions,
  type PublishedKeywords,
} from "./keywords/publish.js";
