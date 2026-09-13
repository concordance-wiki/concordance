import type { LanguagePack } from "../locale/pack.js";
import { comparisonForm } from "./comparison-form.js";

// Punctuation at both ends of a word goes; the inside stays, so that a hyphenated word is one token.
const edges = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const separators = /[^\p{L}\p{N}]+/u;

/**
 * The tokens of a text as a prefix search index stores them: every word normalised by the pack
 * and its comparison form, then, for a word with a hyphen, an apostrophe or another separator
 * inside, each of its parts and their comparison forms; nothing shorter than `minLength`. A
 * query matches a token by prefix, so both the written and the singular form are there for
 * "checks" and "check" to find the same note.
 */
export function searchTokens(text: string, pack: LanguagePack, minLength = 2): Set<string> {
  const tokens = new Set<string>();
  const add = (word: string): void => {
    for (const form of [word, comparisonForm(word, pack)]) {
      if (Array.from(form).length >= minLength) tokens.add(form);
    }
  };
  for (const raw of pack.normalize(text).split(" ")) {
    const word = raw.replace(edges, "");
    // An unsplit word is its own single part; the set keeps it once.
    for (const part of [word, ...word.split(separators)]) add(part);
  }
  return tokens;
}
