import type { IngestedSource } from "@concordance-wiki/ingest";
import { languagePack, tokenize, type LanguagePack, type Occurrence } from "@concordance-wiki/nlp";

import type { ParsedDocument } from "./parse.js";

/** A word the scan recognised in a note, as written there, and the entity it names. */
export interface RecognisedWord {
  line: number;
  /** Code unit offset in the text of its unit, as the occurrence reports it. */
  position: number;
  /** The surface form: the text of the unit from the first token of the match to the last. */
  text: string;
  /** Identifier of the entity the word names. */
  target: string;
}

export interface RecognisedWordsInput {
  occurrences: readonly Occurrence[];
  documents: readonly ParsedDocument[];
  sources: readonly IngestedSource[];
}

function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

/**
 * The text an occurrence covers in the unit it was read from: the match starts at the reported
 * position and spans as many words as its dictionary key has.
 */
function surfaceOf(
  occurrence: Occurrence,
  units: readonly { line: number; text: string }[],
  pack: LanguagePack,
  words: number,
): string | undefined {
  for (const unit of units) {
    if (unit.line !== occurrence.line) continue;
    const tokens = tokenize(unit.text, pack);
    const first = tokens.findIndex((token) => token.start === occurrence.position);
    const last = first === -1 ? undefined : tokens[first + words - 1];
    if (last !== undefined) {
      return unit.text.slice(occurrence.position, last.end);
    }
  }
  return undefined;
}

/**
 * The recognised words of every note, keyed by `<source>/<path>`, in the order of the
 * occurrences; a span several targets share (a homonym) keeps the first target of the canonical
 * order, and an occurrence whose text cannot be located in its unit is left out.
 */
export function recognisedWords(input: RecognisedWordsInput): Map<string, RecognisedWord[]> {
  const locales = new Map(input.sources.map((source) => [source.name, source.locale]));
  const units = new Map(
    input.documents.map((document) => [
      fileKey(document.source, document.path),
      document.document.scannable,
    ]),
  );
  const packs = new Map<string, LanguagePack>();
  const wordCounts = new Map<string, number>();
  const result = new Map<string, RecognisedWord[]>();
  for (const occurrence of input.occurrences) {
    const key = fileKey(occurrence.source, occurrence.path);
    const locale = locales.get(occurrence.source);
    const scannable = units.get(key);
    if (locale === undefined || scannable === undefined) continue;
    let pack = packs.get(locale);
    if (pack === undefined) {
      pack = languagePack(locale);
      packs.set(locale, pack);
    }
    const countKey = `${locale} ${occurrence.key}`;
    let words = wordCounts.get(countKey);
    if (words === undefined) {
      words = tokenize(occurrence.key, pack).length;
      wordCounts.set(countKey, words);
    }
    const found = result.get(key) ?? [];
    const previous = found.at(-1);
    if (previous?.line === occurrence.line && previous.position === occurrence.position) continue;
    const text = surfaceOf(occurrence, scannable, pack, words);
    if (text === undefined) continue;
    found.push({
      line: occurrence.line,
      position: occurrence.position,
      text,
      target: occurrence.target.id,
    });
    result.set(key, found);
  }
  return result;
}
