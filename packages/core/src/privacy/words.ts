export interface Segment {
  text: string;
  /** Character offset of the segment in the text it was cut from. */
  index: number;
  isWordLike: boolean;
}

const APOSTROPHE = /^['’]$/;

/** "d'Alice" is one word for the platform; cut at the apostrophe, the name inside stays matchable. */
function splitApostrophes(part: Segment): Segment[] {
  let offset = 0;
  return part.text
    .split(/(['’])/)
    .map((piece) => {
      const cut = { text: piece, index: part.index + offset, isWordLike: !APOSTROPHE.test(piece) };
      offset += piece.length;
      return cut;
    })
    .filter((piece) => piece.text !== "");
}

/** Cuts a text into words and separators with the platform segmenter; `en` cuts every Latin script the same way. */
export function segment(text: string, locale = "en"): Segment[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  return [...segmenter.segment(text)].flatMap((part) => {
    const cut = { text: part.segment, index: part.index, isWordLike: part.isWordLike === true };
    return cut.isWordLike ? splitApostrophes(cut) : [cut];
  });
}

/** Lowercase without accents, so that "Élodie" and "elodie" compare equal. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

/** The comparison form of a segment: folded, with any run of whitespace read as one space. */
export function foldSegment(segment: Segment): string {
  return /^\s+$/.test(segment.text) ? " " : fold(segment.text);
}
