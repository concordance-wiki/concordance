import type { LanguagePack } from "../locale/pack.js";
import { singularize } from "./singular.js";

// Hyphens and apostrophes stay inside a word; each part they join is singularised on its own,
// so that "couts-benefices" gives "cout-benefice" and "author's" keeps its "s".
const parts = /[^-']+/gu;

function singularizeWord(word: string, pack: LanguagePack): string {
  return word.replace(parts, (part) => singularize(part, pack.plural));
}

/** The words of a text as they are compared: normalised by the pack, then singularised. */
export function comparisonWords(text: string, pack: LanguagePack): string[] {
  const normalised = pack.normalize(text);
  if (normalised === "") {
    return [];
  }
  return normalised.split(" ").map((word) => singularizeWord(word, pack));
}

/**
 * The form two spellings are compared on. The text given is never modified: the caller keeps
 * the original form for display and only compares on the value returned here.
 */
export function comparisonForm(text: string, pack: LanguagePack): string {
  return comparisonWords(text, pack).join(" ");
}
