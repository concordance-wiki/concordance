// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/**
 * The inflected-form suffixes of a pack's `suffixes.txt`: one suffix per line, an optional
 * leading hyphen, `#` starts a comment; returns the unique suffixes in comparison form
 * (through the pack's normaliser), in code unit order.
 */
export function loadSuffixes(text: string, normalize: (text: string) => string): string[] {
  const suffixes = new Set<string>();
  for (const line of text.split("\n")) {
    const hash = line.indexOf("#");
    const suffix = normalize((hash === -1 ? line : line.slice(0, hash)).trim().replace(/^-/, ""));
    if (suffix !== "") {
      suffixes.add(suffix);
    }
  }
  return [...suffixes].sort(byCodeUnit);
}
