import type { LanguagePack } from "../locale/pack.js";
import { keywordForms, type NgramOccurrence } from "./ngrams.js";

/** A recurring expression a note defines: what would be a keyword page, had the note not been written. */
export interface DefinedExpression {
  /** The comparison form of the dictionary entry, as the n-grams carry it. */
  key: string;
  occurrences: number;
  /** Distinct files the expression appears in. */
  documents: number;
}

export interface DefinedExpressionsOptions {
  pack: LanguagePack;
  /** Comparison forms of the dictionary entries. */
  dictionaryKeys: ReadonlySet<string>;
  minOccurrences: number;
  /** Distinct files the expression must appear in. */
  minDocuments: number;
}

interface Counts {
  occurrences: number;
  documents: Set<string>;
}

/**
 * The n-grams the dictionary already defines that reach the publication threshold, in key
 * order. Such an expression gets no keyword page, its note being the page; the build keeps
 * the address the page would have had, so that a word defined after its page was published
 * keeps its URL.
 */
export function definedExpressions(
  occurrences: readonly NgramOccurrence[],
  options: DefinedExpressionsOptions,
): DefinedExpression[] {
  const defined = keywordForms(options.dictionaryKeys, options.pack);
  const counts = new Map<string, Counts>();
  for (const occurrence of occurrences) {
    if (!defined.has(occurrence.key)) continue;
    let count = counts.get(occurrence.key);
    if (count === undefined) {
      count = { occurrences: 0, documents: new Set() };
      counts.set(occurrence.key, count);
    }
    count.occurrences += 1;
    count.documents.add(`${occurrence.source ?? ""}\n${occurrence.path}`);
  }
  return (
    [...counts]
      .filter(
        ([, count]) =>
          count.occurrences >= options.minOccurrences &&
          count.documents.size >= options.minDocuments,
      )
      .map(([key, count]) => ({
        key,
        occurrences: count.occurrences,
        documents: count.documents.size,
      }))
      // Keys are distinct: the comparison never meets two equal ones.
      .sort((a, b) => (a.key < b.key ? -1 : 1))
  );
}
