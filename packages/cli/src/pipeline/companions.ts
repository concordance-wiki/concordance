import type { Neighbours } from "@concordance-wiki/core";
import {
  accumulateCooccurrences,
  neighbourhoodToModel,
  type NeighbourhoodOptions,
  type OccurrenceLike,
} from "@concordance-wiki/inference";
import type { KeywordMention } from "@concordance-wiki/nlp";

export interface KeywordNeighboursInput {
  /** The occurrences of the dictionary entries, as the link production read them. */
  occurrences: readonly OccurrenceLike[];
  /** The mentions of every keyword page by identifier. */
  keywordMentions: ReadonlyMap<string, readonly KeywordMention[]>;
  options: NeighbourhoodOptions;
}

function paragraphKey(occurrence: { source?: string; path: string; line: number }): string {
  return `${occurrence.source ?? ""}\n${occurrence.path}\n${String(occurrence.line)}`;
}

/**
 * The accompanying words of every keyword page: the entities and the other keyword pages named
 * in the paragraphs where the expression is read, counted per paragraph the way the
 * co-occurrence neighbourhood counts them. Only the paragraphs holding a keyword mention are
 * accumulated, so the cost follows the keyword mentions, not the corpus; the rows of the
 * entities themselves are left to the link production.
 */
export function keywordNeighbours(input: KeywordNeighboursInput): Neighbours {
  const paragraphs = new Set<string>();
  const keywordOccurrences: OccurrenceLike[] = [];
  for (const [id, mentions] of input.keywordMentions) {
    for (const mention of mentions) {
      paragraphs.add(paragraphKey(mention));
      keywordOccurrences.push({
        target: { id },
        ...(mention.source === undefined ? {} : { source: mention.source }),
        path: mention.path,
        line: mention.line,
      });
    }
  }
  const shared = input.occurrences.filter((occurrence) => paragraphs.has(paragraphKey(occurrence)));
  const neighbourhood = accumulateCooccurrences([...shared, ...keywordOccurrences], input.options);
  const block = neighbourhoodToModel(neighbourhood);
  const rows: Neighbours = {};
  for (const id of [...input.keywordMentions.keys()].sort()) {
    const row = block[id];
    if (row !== undefined && row.length > 0) rows[id] = row;
  }
  return rows;
}
