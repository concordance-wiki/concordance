const combiningMarks = /\p{M}+/gu;
const apostrophes = /’/g;
const whitespace = /\s+/g;

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(apostrophes, "'")
    .replace(whitespace, " ")
    .trim();
}
