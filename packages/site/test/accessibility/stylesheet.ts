import { expect } from "vitest";

import { baseStylesheet, componentsStylesheet } from "../../src/css/stylesheet.js";

/** One rule of a stylesheet: its selector list with the spaces collapsed, its declarations, and the query it sits under. */
export interface Rule {
  selector: string;
  declarations: Record<string, string>;
  /** The `@media` or `@supports` prelude the rule is nested in; absent at the top level. */
  under?: string;
}

function parseDeclarations(block: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const line of block.split(";")) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    declarations[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return declarations;
}

/** Every rule of a stylesheet in source order, the rules of a nested block flattened under its prelude; comments left out. */
export function rules(css: string, under?: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: Rule[] = [];
  let from = 0;
  for (;;) {
    const open = text.indexOf("{", from);
    if (open < 0) break;
    const prelude = text.slice(from, open).trim().replace(/\s+/g, " ");
    let depth = 1;
    let close = open + 1;
    for (; close < text.length && depth > 0; close += 1) {
      if (text[close] === "{") depth += 1;
      if (text[close] === "}") depth -= 1;
    }
    const body = text.slice(open + 1, close - 1);
    if (prelude.startsWith("@")) {
      found.push(...rules(body, prelude));
    } else {
      found.push({
        selector: prelude,
        declarations: parseDeclarations(body),
        ...(under === undefined ? {} : { under }),
      });
    }
    from = close;
  }
  return found;
}

/** The rules of the base layer then the components layer, in cascade order. */
export const shipped: readonly Rule[] = [
  ...rules(baseStylesheet()),
  ...rules(componentsStylesheet()),
];

/** The selectors of a selector list, trimmed. */
export function selectorsOf(rule: Rule): string[] {
  return rule.selector.split(",").map((selector) => selector.trim());
}

/** The rules whose selector list names the selector exactly, at the top level or under a query. */
export function rulesFor(selector: string): Rule[] {
  return shipped.filter((rule) => selectorsOf(rule).includes(selector));
}

/** The declarations of the one top-level rule whose selector list is exactly the given one. */
export function declarationsOf(selector: string): Record<string, string> {
  const wanted = selector.replace(/\s+/g, " ");
  const found = shipped.filter((rule) => rule.under === undefined && rule.selector === wanted);
  expect(found, selector).toHaveLength(1);
  return found[0]?.declarations ?? {};
}

/** A length in pixels: rem on the 16 px base of the theme, px as written; anything else is not a length the test reads. */
export function pixels(value: string | undefined): number | undefined {
  const match = /^([\d.]+)(rem|px)$/.exec(value ?? "");
  if (match === null) return undefined;
  return match[2] === "rem" ? Number(match[1]) * 16 : Number(match[1]);
}
