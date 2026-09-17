// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** What an alphabetical order sets aside, as a language pack declares it. */
export interface CollationOptions {
  /** `base` sets accents and case aside, `accent` keeps the accents, `case` keeps the case, `variant` keeps both; `variant` when absent. */
  sensitivity?: "base" | "accent" | "case" | "variant";
  /** Digits compared by value: "item 2" before "item 10". */
  numeric?: boolean;
  /** Punctuation, symbols and spaces set aside. */
  ignorePunctuation?: boolean;
}

const MARKS = /\p{M}/gu;
const PUNCTUATION = /[\p{P}\p{S}\s]/gu;
const DIGITS = /(\d+)/u;
const LEADING_ZEROS = /^0+(?=\d)/u;

/** The text as the order reads it: decomposed, its accents and case set aside as the options say. */
function keyOf(text: string, options: CollationOptions): string {
  const sensitivity = options.sensitivity ?? "variant";
  let key = text.normalize("NFD");
  if (sensitivity === "base" || sensitivity === "case") key = key.replace(MARKS, "");
  if (sensitivity === "base" || sensitivity === "accent") key = key.toLowerCase();
  if (options.ignorePunctuation === true) key = key.replace(PUNCTUATION, "");
  return key;
}

/** Two runs of digits by value: the shorter without its leading zeros is the smaller, then digit by digit. */
function byValue(a: string, b: string): number {
  const p = a.replace(LEADING_ZEROS, "");
  const q = b.replace(LEADING_ZEROS, "");
  return p.length - q.length || byCodeUnit(p, q);
}

/** Text and runs of digits alternating, the runs compared by value: the split keeps the digits at the odd ranks. */
function byNumericChunks(a: string, b: string): number {
  const left = a.split(DIGITS);
  const right = b.split(DIGITS);
  for (const [rank, x] of left.entries()) {
    const y = right[rank];
    if (y === undefined) break;
    const order = rank % 2 === 1 ? byValue(x, y) : byCodeUnit(x, y);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

/**
 * An alphabetical order computed from the options alone, the same on every runtime: no
 * collation data of the platform is read, so that the pages of a site and the answers of the
 * command line come out in the same order wherever they are built. Two texts the options tell
 * apart by nothing compare equal; a caller breaks the tie by an identifier.
 */
export function collation(options: CollationOptions): (a: string, b: string) => number {
  return (a, b) => {
    const x = keyOf(a, options);
    const y = keyOf(b, options);
    return options.numeric === true ? byNumericChunks(x, y) : byCodeUnit(x, y);
  };
}
