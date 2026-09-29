import type { LanguagePack } from "../locale/pack.js";
import { occurrenceContext, type QuotedText } from "../scan/context.js";
import { tokenize, type Token } from "../scan/tokens.js";

/** A text unit the discovery reads: a scannable unit of a document, with the file it comes from. */
export interface KeywordUnit extends QuotedText {
  /** Name of the source holding the file; two sources may hold the same path. */
  source?: string;
  path: string;
  line: number;
  /** The text the discovery reads, inline code left out. */
  text: string;
}

/**
 * One n-gram met once. It carries where it was met, never what it looked like: a corpus yields
 * millions of these and only the few thousand above the thresholds ever need their surface form
 * or their context, which `ngramSurface` and `ngramContext` read from the unit on demand.
 */
export interface NgramOccurrence {
  /** The words in comparison form, joined by a single space. */
  key: string;
  source?: string;
  path: string;
  line: number;
  /** Code unit offset of the span in the unit text. */
  position: number;
  /** Code unit offset of the end of the span in the unit text. */
  end: number;
  /** The unit the span was read in, which holds the text the surface and the context are cut from. */
  unit: KeywordUnit;
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

/** The span as written in the text of its unit. */
export function ngramSurface(occurrence: NgramOccurrence): string {
  return occurrence.unit.text.slice(occurrence.position, occurrence.end);
}

/**
 * 160 characters of the unit text as written, inline code included, centred on the span, an
 * ellipsis marking each cut.
 */
export function ngramContext(occurrence: NgramOccurrence): string {
  return occurrenceContext(occurrence.unit, occurrence.position, occurrence.end, contextWidth);
}

/** The n-grams of one unit starting at each token that is not a stopword, in text order. */
function ngramsOf(
  unit: KeywordUnit,
  tokens: readonly Token[],
  rules: NgramRules,
  keys: Map<string, string>,
): NgramOccurrence[] {
  const occurrences: NgramOccurrence[] = [];
  for (const [start, first] of tokens.entries()) {
    // A candidate never starts with a stopword, whatever its length.
    if (rules.stopwords.has(first.word)) continue;
    const words: string[] = [];
    for (const last of tokens.slice(start, start + rules.maxWords)) {
      words.push(last.word);
      if (!isCandidate(words, last.word, rules)) continue;
      const written = words.join(" ");
      // One string per distinct key for the whole run: the same expression is met again and again,
      // and the copies the join makes are dropped instead of being held until the scoring.
      const key = keys.get(written) ?? written;
      keys.set(key, key);
      occurrences.push({
        key,
        ...(unit.source === undefined ? {} : { source: unit.source }),
        path: unit.path,
        line: unit.line,
        position: first.start,
        end: last.end,
        unit,
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
  const keys = new Map<string, string>();
  return units.flatMap((unit) => ngramsOf(unit, tokenize(unit.text, pack), rules, keys));
}
