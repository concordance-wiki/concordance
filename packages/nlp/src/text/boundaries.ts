import type { LanguagePack } from "../locale/pack.js";

/** A word-like segment of a text, `end` exclusive, in code units of the text as given. */
export interface WordBoundary {
  start: number;
  end: number;
  word: string;
}

/** Every word of a text with its position, in text order, as the pack's segmenter cuts it. */
export function wordBoundaries(text: string, pack: LanguagePack): WordBoundary[] {
  return pack
    .segment(text)
    .filter((word) => word.isWordLike)
    .map((word) => ({ start: word.index, end: word.index + word.text.length, word: word.text }));
}

/** True when a word starts at `start` and a word ends at `end` (exclusive), possibly different ones. */
export function isOnWordBoundaries(
  text: string,
  start: number,
  end: number,
  pack: LanguagePack,
): boolean {
  const words = wordBoundaries(text, pack);
  return words.some((word) => word.start === start) && words.some((word) => word.end === end);
}
