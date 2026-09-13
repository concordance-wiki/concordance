import type { LanguagePack } from "../locale/pack.js";
import { tokenize, type Token } from "../scan/tokens.js";
import { contextAround } from "../text/context.js";

/** A text unit the discovery reads: a scannable unit of a document, with the file it comes from. */
export interface KeywordUnit {
  /** Name of the source holding the file; two sources may hold the same path. */
  source?: string;
  path: string;
  line: number;
  text: string;
}

export interface NgramOccurrence {
  /** The words in comparison form, joined by a single space. */
  key: string;
  /** The span as written in the text. */
  surface: string;
  source?: string;
  path: string;
  line: number;
  /** Code unit offset of the span in the unit text. */
  position: number;
  /** 160 characters of the unit text centred on the span, an ellipsis marking each cut. */
  context: string;
}

export interface ExtractNgramsOptions {
  /** Shortest n-gram, in words; 1 by default. */
  minWords?: number;
  /** Longest n-gram, in words. */
  maxWords: number;
  /** Below this length of the key, an n-gram is noise. */
  minLength: number;
  /** The pack's stopwords by default; given as written, compared in comparison form. */
  stopwords?: ReadonlySet<string>;
}

const contextWidth = 160;
const digitsOnly = /^\p{N}+$/u;

/** The comparison form of a term as the n-grams carry it: its words, tokenised like the texts. */
export function keywordForm(text: string, pack: LanguagePack): string {
  return tokenize(text, pack)
    .map((token) => token.word)
    .join(" ");
}

/** The comparison forms of a list of terms. */
export function keywordForms(forms: Iterable<string>, pack: LanguagePack): Set<string> {
  return new Set([...forms].map((form) => keywordForm(form, pack)));
}

/** What every n-gram of a run is filtered and cut with. */
interface NgramRules {
  minWords: number;
  maxWords: number;
  minLength: number;
  stopwords: ReadonlySet<string>;
}

/** Whether the words so far form a candidate: enough of them, the last not a stopword, not digits alone, long enough. */
function isCandidate(words: readonly string[], last: string, rules: NgramRules): boolean {
  if (words.length < rules.minWords || rules.stopwords.has(last)) return false;
  if (words.every((word) => digitsOnly.test(word))) return false;
  return words.join(" ").length >= rules.minLength;
}

/** The n-grams of one unit starting at each token that is not a stopword, in text order. */
function ngramsOf(
  unit: KeywordUnit,
  tokens: readonly Token[],
  rules: NgramRules,
): NgramOccurrence[] {
  const occurrences: NgramOccurrence[] = [];
  for (const [start, first] of tokens.entries()) {
    // A candidate never starts with a stopword, whatever its length.
    if (rules.stopwords.has(first.word)) continue;
    const words: string[] = [];
    for (const last of tokens.slice(start, start + rules.maxWords)) {
      words.push(last.word);
      if (!isCandidate(words, last.word, rules)) continue;
      occurrences.push({
        key: words.join(" "),
        surface: unit.text.slice(first.start, last.end),
        ...(unit.source === undefined ? {} : { source: unit.source }),
        path: unit.path,
        line: unit.line,
        position: first.start,
        context: contextAround(unit.text, first.start, last.end, contextWidth),
      });
    }
  }
  return occurrences;
}

/**
 * Every n-gram of `minWords` to `maxWords` words in the units, in unit then text order,
 * except those starting or ending with a stopword, those made only of digits and those
 * whose key is shorter than `minLength`. Words are the tokens of the text: normalised by
 * the pack and singularised, so that "Build summaries" and "build summary"
 * share a key while each keeps its surface form.
 */
export function extractNgrams(
  units: readonly KeywordUnit[],
  pack: LanguagePack,
  options: ExtractNgramsOptions,
): NgramOccurrence[] {
  const rules: NgramRules = {
    minWords: options.minWords ?? 1,
    maxWords: options.maxWords,
    minLength: options.minLength,
    stopwords: keywordForms(options.stopwords ?? pack.stopwords, pack),
  };
  return units.flatMap((unit) => ngramsOf(unit, tokenize(unit.text, pack), rules));
}
