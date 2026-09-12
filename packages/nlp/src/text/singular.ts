import type { PluralRule } from "../locale/pack.js";

/**
 * Brings a normalised word (lowercase, no accents) back to its singular: the first rule
 * whose ending the word carries, and whose minimum length the word reaches, applies.
 */
export function singularize(word: string, rules: readonly PluralRule[]): string {
  const rule = rules.find(
    ({ ending, minLength }) => word.length >= minLength && word.endsWith(ending),
  );
  if (rule === undefined) {
    return word;
  }
  return word.slice(0, word.length - rule.ending.length) + rule.singular;
}
