import { expect } from "vitest";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** Fails when a tag is closed out of order or left open; enough to catch a broken template. */
export function expectBalanced(html: string): void {
  const stack: string[] = [];
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    const [, closing, tag, selfClosing] = match;
    const name = (tag ?? "").toLowerCase();
    if (closing === "/") {
      expect(stack.pop()).toBe(name);
    } else if (!VOID_ELEMENTS.has(name) && selfClosing !== "/") {
      stack.push(name);
    }
  }
  expect(stack).toEqual([]);
}

/** How many times a substring occurs. */
export function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}
