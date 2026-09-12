import { byCodeUnit, compareNeighbours } from "./order.js";
import type { Neighbour, Neighbourhood, NeighbourhoodOptions, OccurrenceLike } from "./types.js";

/**
 * Distinct identifiers paired in one paragraph. A paragraph naming more entities is a list or a
 * table rather than prose; pairing all of them would cost a quadratic number of increments for
 * a signal that says little, so only the first ones by identifier are paired.
 */
const PARAGRAPH_CAP = 200;

function best(row: ReadonlyMap<string, number>, k: number): Neighbour[] {
  return [...row]
    .map(([id, count]): Neighbour => ({ id, count }))
    .sort(compareNeighbours)
    .slice(0, k);
}

interface Paragraph {
  source: string;
  path: string;
  line: number;
  members: Set<string>;
}

function compareParagraphs(a: Paragraph, b: Paragraph): number {
  return byCodeUnit(a.source, b.source) || byCodeUnit(a.path, b.path) || a.line - b.line;
}

/**
 * The distinct identifiers of every paragraph, paragraphs in `(source, path, line)` order and
 * identifiers in code-unit order, so that the result depends on the set of occurrences alone.
 */
function paragraphs(occurrences: readonly OccurrenceLike[]): string[][] {
  const byKey = new Map<string, Paragraph>();
  for (const occurrence of occurrences) {
    const source = occurrence.source ?? "";
    const key = `${source}\n${occurrence.path}\n${String(occurrence.line)}`;
    let paragraph = byKey.get(key);
    if (paragraph === undefined) {
      paragraph = { source, path: occurrence.path, line: occurrence.line, members: new Set() };
      byKey.set(key, paragraph);
    }
    paragraph.members.add(occurrence.target.id);
  }
  return [...byKey.values()]
    .sort(compareParagraphs)
    .map((paragraph) => [...paragraph.members].sort(byCodeUnit).slice(0, PARAGRAPH_CAP));
}

/**
 * Two entities named in the same paragraph are neighbours; their count is the number of such
 * paragraphs. Each node keeps its own row of counts, trimmed to the best `k` whenever it grows
 * past `2k`, so that memory stays proportional to the number of nodes times `k` and never to the
 * square of the number of nodes. A neighbour dropped by a trim starts again from zero if it
 * reappears: the counts of the retained neighbours are exact only when the neighbour was never
 * dropped, which holds as soon as the frequent pairs stand out from the occasional ones.
 */
export function accumulateCooccurrences(
  occurrences: readonly OccurrenceLike[],
  options: NeighbourhoodOptions,
): Neighbourhood {
  const { k } = options;
  const rows = new Map<string, Map<string, number>>();
  const bump = (from: string, to: string): void => {
    let row = rows.get(from);
    if (row === undefined) {
      row = new Map();
      rows.set(from, row);
    }
    row.set(to, (row.get(to) ?? 0) + 1);
    if (row.size > 2 * k) {
      rows.set(from, new Map(best(row, k).map((neighbour) => [neighbour.id, neighbour.count])));
    }
  };
  for (const members of paragraphs(occurrences)) {
    // Members are distinct: every unordered pair is met once and a node never meets itself.
    for (const a of members) {
      for (const b of members) {
        if (a < b) {
          bump(a, b);
          bump(b, a);
        }
      }
    }
  }
  const nodes = new Map(
    [...rows].sort(([a], [b]) => byCodeUnit(a, b)).map(([id, row]) => [id, best(row, k)]),
  );
  return { k, nodes };
}
