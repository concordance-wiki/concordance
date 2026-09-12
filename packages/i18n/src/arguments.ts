import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

/** The ICU argument kinds a message can declare; a tag counts as an argument because it needs a formatting function. */
export type ArgumentKind = "argument" | "number" | "date" | "time" | "select" | "plural" | "tag";

export type ParsedMessage =
  { ok: true; elements: MessageFormatElement[] } | { ok: false; reason: string };

export function describeSyntaxError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseMessage(message: string): ParsedMessage {
  try {
    return { ok: true, elements: parse(message) };
  } catch (error: unknown) {
    return { ok: false, reason: describeSyntaxError(error) };
  }
}

const kinds: Record<Exclude<TYPE, TYPE.literal | TYPE.pound>, ArgumentKind> = {
  [TYPE.argument]: "argument",
  [TYPE.number]: "number",
  [TYPE.date]: "date",
  [TYPE.time]: "time",
  [TYPE.select]: "select",
  [TYPE.plural]: "plural",
  [TYPE.tag]: "tag",
};

function collect(elements: MessageFormatElement[], into: Map<string, ArgumentKind>): void {
  for (const element of elements) {
    if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
    if (!into.has(element.value)) into.set(element.value, kinds[element.type]);
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const option of Object.values(element.options)) collect(option.value, into);
    } else if (element.type === TYPE.tag) {
      collect(element.children, into);
    }
  }
}

/** The arguments of a parsed message, by name in sorted order; the first kind wins when a name is reused. */
export function argumentsOf(elements: MessageFormatElement[]): ReadonlyMap<string, ArgumentKind> {
  const found = new Map<string, ArgumentKind>();
  collect(elements, found);
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : 1)));
}
