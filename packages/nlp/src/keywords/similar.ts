/** How many similar expressions a page offers as a lead. */
export const SIMILAR_EXPRESSIONS_LIMIT = 5;

/** What the comparison needs of an expression: its key, the words in comparison form joined by a space. */
export interface KeyedExpression {
  key: string;
}

function wordsOf(key: string): string[] {
  return key.split(" ");
}

/** Whether `part` is a contiguous run of the words of `whole`: a prefix, a suffix or an inner expression. */
function contains(whole: readonly string[], part: readonly string[]): boolean {
  return whole.some((_, start) => part.every((word, index) => whole[start + index] === word));
}

/** The share of the distinct words of both expressions they have in common. */
function overlap(a: readonly string[], b: readonly string[]): number {
  const words = new Set(a);
  const shared = new Set(b.filter((word) => words.has(word))).size;
  return shared / new Set([...a, ...b]).size;
}

/**
 * Whether two expressions have a similar form: one is a contiguous part of the other, or they
 * share at least half of the distinct words of the longer one. Keys are compared word by word
 * in their comparison form, so that a plural and its singular already read alike.
 */
export function similarForm(a: string, b: string): boolean {
  const wordsA = wordsOf(a);
  const wordsB = wordsOf(b);
  if (contains(wordsA, wordsB) || contains(wordsB, wordsA)) return true;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const shared = [...setB].filter((word) => setA.has(word)).length;
  return 2 * shared >= Math.max(setA.size, setB.size);
}

/**
 * The expressions of a similar form to `key`, the closest first: by decreasing share of common
 * words, then by key; at most `limit` of them, the expression itself never among them and each
 * key once. The result depends on the set of candidates alone.
 */
export function similarExpressions<T extends KeyedExpression>(
  key: string,
  candidates: readonly T[],
  limit: number = SIMILAR_EXPRESSIONS_LIMIT,
): T[] {
  const words = wordsOf(key);
  const seen = new Set<string>([key]);
  const similar: { candidate: T; overlap: number }[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.key) || !similarForm(key, candidate.key)) continue;
    seen.add(candidate.key);
    similar.push({ candidate, overlap: overlap(words, wordsOf(candidate.key)) });
  }
  return (
    similar
      // Keys are distinct here, so the tie-break never meets two equal ones.
      .sort((a, b) => b.overlap - a.overlap || (a.candidate.key < b.candidate.key ? -1 : 1))
      .slice(0, limit)
      .map((item) => item.candidate)
  );
}
