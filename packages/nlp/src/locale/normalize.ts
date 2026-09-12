const combiningMarks = /\p{M}+/gu;
const whitespace = /\s+/g;

/** Builds the normaliser of a locale from the apostrophe characters its pack unifies. */
export function normalizer(apostrophes: readonly string[]): (text: string) => string {
  const variants = new Set(apostrophes);
  return (text) =>
    text
      .normalize("NFD")
      .replace(combiningMarks, "")
      .toLowerCase()
      .replace(/./gu, (character) => (variants.has(character) ? "'" : character))
      .replace(whitespace, " ")
      .trim();
}
