/** A text after normalisation: its lines in comparison form and its size. */
export interface NormalisedText {
  /** Non-empty lines, each the words of the line joined by a space. */
  lines: string[];
  words: string[];
  characters: number;
}

export function normaliseText(
  text: string,
  normalizeText: (text: string) => string[],
): NormalisedText {
  const lines: string[] = [];
  const words: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const lineWords = normalizeText(line);
    if (lineWords.length === 0) continue;
    lines.push(lineWords.join(" "));
    words.push(...lineWords);
  }
  return { lines, words, characters: words.join(" ").length };
}

/** The distinct runs of `size` consecutive words; empty for a text shorter than `size`. */
export function shingleSet(words: readonly string[], size: number): Set<string> {
  const shingles = new Set<string>();
  for (let start = 0; start + size <= words.length; start++) {
    shingles.add(words.slice(start, start + size).join(" "));
  }
  return shingles;
}

/** `|a ∩ b| / |a ∪ b|`; 0 when both are empty. */
export function exactJaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let common = 0;
  for (const shingle of a) {
    if (b.has(shingle)) common++;
  }
  const union = a.size + b.size - common;
  return union === 0 ? 0 : common / union;
}

/** Distinct lines in common over the distinct lines of both texts. */
export function sharedLines(a: readonly string[], b: readonly string[]): number {
  return exactJaccard(new Set(a), new Set(b));
}
