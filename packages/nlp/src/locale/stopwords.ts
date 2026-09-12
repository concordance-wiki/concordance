/** One word per line, `#` starts a comment; returns the unique lowercase words in code unit order. */
export function loadStopwords(text: string): string[] {
  const words = new Set<string>();
  for (const line of text.split("\n")) {
    const hash = line.indexOf("#");
    const word = (hash === -1 ? line : line.slice(0, hash)).trim().toLowerCase();
    if (word !== "") {
      words.add(word);
    }
  }
  return [...words].sort();
}
