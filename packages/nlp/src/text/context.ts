const ellipsis = "…";

const MARK = /\p{M}/u;

/** Whether cutting the text before this code unit would split a surrogate pair or orphan a combining mark. */
function splits(text: string, at: number): boolean {
  const code = text.charCodeAt(at);
  return (code >= 0xdc00 && code <= 0xdfff) || MARK.test(text.charAt(at));
}

/**
 * A window of `width` characters of the text centred on the span `start`–`end`, kept inside
 * the text, an ellipsis marking each cut. A cut never falls inside a character: a surrogate
 * pair or a letter and its combining marks stay together, the window growing by what it takes.
 */
export function contextAround(text: string, start: number, end: number, width: number): string {
  const centre = Math.floor((start + end) / 2);
  let from = Math.max(0, Math.min(Math.floor(centre - width / 2), text.length - width));
  let to = Math.min(text.length, from + width);
  while (from > 0 && splits(text, from)) from -= 1;
  while (to < text.length && splits(text, to)) to += 1;
  return `${from > 0 ? ellipsis : ""}${text.slice(from, to)}${to < text.length ? ellipsis : ""}`;
}
