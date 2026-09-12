import type { LanguagePack, Word } from "../locale/pack.js";
import { singularize } from "../text/singular.js";

/** A word of a text as the scan compares it, with its character span in the text as given. */
export interface Token {
  /** Comparison form of the word: normalised by the pack, then singularised. */
  word: string;
  start: number;
  /** Exclusive, in code units of the original text. */
  end: number;
}

interface Piece {
  text: string;
  start: number;
}

const notLetterOrDigit = /[^\p{L}\p{M}\p{N}]/gu;

// The segmenter cuts a hyphenated compound into its parts ("versement-libre" gives the tokens
// "versement" and "libre", so that both "versement" and "versement libre" match there) but keeps
// an apostrophe inside its word ("l'écran"): the parts an apostrophe binds are cut here the same
// way, with the apostrophe characters the pack unifies.
function pieces(segment: Word, pack: LanguagePack): Piece[] {
  const result: Piece[] = [];
  let start = 0;
  for (const match of segment.text.matchAll(notLetterOrDigit)) {
    if (pack.normalize(match[0]) !== "'") continue;
    result.push({ text: segment.text.slice(start, match.index), start: segment.index + start });
    start = match.index + 1;
  }
  result.push({ text: segment.text.slice(start), start: segment.index + start });
  return result;
}

/** The words of a text in text order, each in comparison form with its span in the text. */
export function tokenize(text: string, pack: LanguagePack): Token[] {
  const tokens: Token[] = [];
  for (const segment of pack.segment(text)) {
    if (!segment.isWordLike) continue;
    for (const piece of pieces(segment, pack)) {
      const word = singularize(pack.normalize(piece.text), pack.plural);
      if (word === "") continue;
      tokens.push({ word, start: piece.start, end: piece.start + piece.text.length });
    }
  }
  return tokens;
}
