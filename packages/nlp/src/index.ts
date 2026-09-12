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
