import { contextAround } from "../text/context.js";

/** An inline code span the scanned text leaves out: what was written, at the offset it stood at. */
export interface ElidedCode {
  /** Offset in the scanned text where the code stood; the code precedes the character there. */
  at: number;
  text: string;
}

/** What the context of an occurrence is cut from: the scanned text and the code it leaves out. */
export interface QuotedText {
  text: string;
  code?: readonly ElidedCode[];
}

/** How many characters of the text an occurrence quotes. */
export const CONTEXT_WIDTH = 80;

/**
 * The context of an occurrence: a window of `width` characters of the text as written, the
 * inline code the scan skipped put back in place, centred on the match at `start`–`end` of the
 * scanned text. A code span at the start of the match precedes it, one at its end follows it.
 */
export function occurrenceContext(
  quoted: QuotedText,
  start: number,
  end: number,
  width = CONTEXT_WIDTH,
): string {
  const code = quoted.code ?? [];
  let written = "";
  let cursor = 0;
  let from = start;
  let to = end;
  for (const span of code) {
    written += quoted.text.slice(cursor, span.at) + span.text;
    cursor = span.at;
    if (span.at <= start) from += span.text.length;
    if (span.at < end) to += span.text.length;
  }
  written += quoted.text.slice(cursor);
  return contextAround(written, from, to, width);
}
