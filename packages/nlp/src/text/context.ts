const ellipsis = "…";

/**
 * A window of `width` characters of the text centred on the span `start`–`end`, kept inside
 * the text, an ellipsis marking each cut.
 */
export function contextAround(text: string, start: number, end: number, width: number): string {
  const centre = Math.floor((start + end) / 2);
  const from = Math.max(0, Math.min(centre - width / 2, text.length - width));
  const to = Math.min(text.length, from + width);
  return `${from > 0 ? ellipsis : ""}${text.slice(from, to)}${to < text.length ? ellipsis : ""}`;
}
