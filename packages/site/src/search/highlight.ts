/**
 * How a title marks the words of a query: the start of every token a word prefixes, compared
 * on the same folded form as the index. Nothing here reaches Node either: the island marks
 * the titles of the live results.
 */

import { normalizeQuery } from "./shared.js";

/** A piece of a title: plain text, or the start of a token a word of the query matched. */
export interface TitlePiece {
  text: string;
  marked: boolean;
}

const alphanumeric = /[\p{L}\p{N}]/u;

/** A character of the title with its folded form, empty for a combining mark the folding drops. */
interface Folded {
  text: string;
  folded: string;
}

function foldCharacters(text: string): Folded[] {
  return Array.from(text).map((character) => ({
    text: character,
    folded: normalizeQuery(character),
  }));
}

/** The span of a token, in its characters, that the query marks: from its first letter or digit to the end of the longest word matched. */
interface Span {
  start: number;
  end: number;
}

/**
 * The span of a token whose folded form the longest word of the query covers; none when no word
 * prefixes the token. A word is matched against the token from its first letter or digit, as
 * the index trims the punctuation at the edges of a token, and the mark carries the combining
 * marks that follow its last letter, so that an accent is never cut from its letter.
 */
function matchedSpan(token: Folded[], words: readonly string[]): Span | undefined {
  const start = token.findIndex((character) => alphanumeric.test(character.folded));
  if (start < 0) return undefined;
  const folded = token
    .slice(start)
    .map((character) => character.folded)
    .join("");
  const longest = words
    .filter((word) => folded.startsWith(word))
    .reduce((best, word) => Math.max(best, word.length), 0);
  if (longest === 0) return undefined;
  let covered = 0;
  let end = start;
  while (end < token.length && (covered < longest || token[end]?.folded === "")) {
    // The loop stops before the end of the token: its folded form holds at least `longest` characters.
    covered += (token[end] as Folded).folded.length;
    end += 1;
  }
  return { start, end };
}

function textOf(characters: readonly Folded[]): string {
  return characters.map((character) => character.text).join("");
}

/** The title cut into pieces, the start of every token a word of the query prefixes marked; one plain piece when nothing matches. */
export function markTitle(title: string, words: readonly string[]): TitlePiece[] {
  const pieces: TitlePiece[] = [];
  const push = (text: string, marked: boolean): void => {
    if (text === "") return;
    const last = pieces[pieces.length - 1];
    if (last?.marked === marked) {
      last.text += text;
    } else {
      pieces.push({ text, marked });
    }
  };
  for (const part of title.split(/(\s+)/)) {
    const token = foldCharacters(part);
    const span = /^\s*$/.test(part) ? undefined : matchedSpan(token, words);
    if (span === undefined) {
      push(part, false);
      continue;
    }
    push(textOf(token.slice(0, span.start)), false);
    push(textOf(token.slice(span.start, span.end)), true);
    push(textOf(token.slice(span.end)), false);
  }
  return pieces.length === 0 ? [{ text: "", marked: false }] : pieces;
}
