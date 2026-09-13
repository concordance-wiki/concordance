import type { Mention } from "../../slots.js";

/** The mentions of the fixtures come three per note, so that the related pages count several passages. */
export const MENTIONS_PER_NOTE = 3;

/** The notes of the fixtures alternate between two types, so that the type filter has something to filter. */
const NOTE_TYPES = [
  { type: "term", typeLabel: "Term" },
  { type: "screen", typeLabel: "Screen" },
] as const;

export function mention(index: number, kind: Mention["kind"] = "recognised"): Mention {
  const number = Math.ceil(index / MENTIONS_PER_NOTE);
  const note = `note-${String(number)}`;
  // The index is always in range: the modulo keeps it under the length of the list.
  const { type, typeLabel } = NOTE_TYPES[
    (number - 1) % NOTE_TYPES.length
  ] as (typeof NOTE_TYPES)[number];
  return {
    kind,
    file: { label: `${note}.md`, href: `../notes/${note}/` },
    title: `Note ${String(number)}`,
    type,
    typeLabel,
    context: `passage ${String(index)} cites the entity`,
    line: index,
    href: `../notes/${note}/#L${String(index)}`,
    surface: "the entity",
  };
}

export function mentions(total: number, written = 2): Mention[] {
  return Array.from({ length: total }, (_, index) =>
    mention(index + 1, index < written ? "written" : "recognised"),
  );
}
