/** How an extra glossary occurrence raises the confidence, and where it stops. */
export interface GlossaryCombination {
  bonus: number;
  cap: number;
}

// Four decimals: `model.json` serialises the number and a build must not differ by a floating-point
// tail such as `0.96` written `0.9600000000000001`.
const SCALE = 10_000;

function round(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

/**
 * The confidence that at least one of several independent methods is right: `1 − Π(1 − cᵢ)`,
 * clamped to [0, 1] and rounded to four decimals. No method gives no confidence.
 */
export function combineConfidences(values: readonly number[]): number {
  let miss = 1;
  for (const value of values) miss *= 1 - value;
  return round(Math.min(1, Math.max(0, 1 - miss)));
}

/**
 * The confidence of a term mentioned `occurrences` times (at least once) in one document: the base
 * plus one bonus per additional occurrence, never above the cap, rounded to four decimals.
 */
export function glossaryConfidence(
  base: number,
  occurrences: number,
  options: GlossaryCombination,
): number {
  return round(Math.min(base + options.bonus * (occurrences - 1), options.cap));
}
