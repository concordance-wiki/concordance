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
