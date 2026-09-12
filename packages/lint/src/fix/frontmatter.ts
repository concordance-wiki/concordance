import { isMap, parseDocument, type Document, type Pair } from "yaml";

import type { FixChange } from "./types.js";

export interface NormalizeFrontmatterOptions {
  /** Forward-slash path of the file, for the announced changes. */
  path: string;
  /** The type the cascade gives the file; written only when the frontmatter has none. */
  deducedType?: string;
}

/** Keys written first, in this order; every other key follows alphabetically. */
export const CANONICAL_KEY_ORDER: readonly string[] = ["id", "type", "title", "aliases", "status"];

/** The block between the opening `---` line and the closing one; a file without it has no frontmatter. */
const block = /^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/;

const serialisation = { lineWidth: 0, indent: 2 } as const;

function keyOf(pair: Pair): string {
  return String(pair.key);
}

function rankOf(key: string): number {
  const rank = CANONICAL_KEY_ORDER.indexOf(key);
  return rank === -1 ? CANONICAL_KEY_ORDER.length : rank;
}

/** Keys are unique in a valid mapping, so two keys never compare equal. */
function compareKeys(left: string, right: string): number {
  const byRank = rankOf(left) - rankOf(right);
  if (byRank !== 0) return byRank;
  return left < right ? -1 : 1;
}

function orderKeys(document: Document): string[] | undefined {
  if (!isMap(document.contents)) return undefined;
  const items = document.contents.items;
  const ordered = [...items].sort((left, right) => compareKeys(keyOf(left), keyOf(right)));
  if (ordered.every((pair, index) => pair === items[index])) return undefined;
  document.contents.items = ordered;
  return ordered.map(keyOf);
}

/**
 * Reorders the keys of a valid frontmatter and adds the deduced `type` when the block has none; the
 * body is returned byte for byte, and an invalid or absent frontmatter leaves the text untouched.
 */
export function normalizeFrontmatter(
  text: string,
  options: NormalizeFrontmatterOptions,
): { text: string; changes: FixChange[] } {
  const match = block.exec(text);
  if (match === null) return { text, changes: [] };
  const whole = match[0];
  const eol = whole.startsWith("---\r\n") ? "\r\n" : "\n";
  const closing = whole.endsWith("---") ? "" : eol;
  const document = parseDocument(whole.slice(3 + eol.length, whole.length - 3 - closing.length));
  if (document.errors.length > 0 || (document.contents !== null && !isMap(document.contents))) {
    return { text, changes: [] };
  }
  const changes: FixChange[] = [];
  if (options.deducedType !== undefined && !document.has("type")) {
    document.set("type", options.deducedType);
    changes.push({
      kind: "frontmatter-type",
      path: options.path,
      line: 1,
      description: `add the deduced "type: ${options.deducedType}" to the frontmatter`,
    });
  }
  const order = orderKeys(document);
  if (order !== undefined) {
    changes.push({
      kind: "frontmatter-order",
      path: options.path,
      line: 1,
      description: `order the frontmatter keys: ${order.join(", ")}`,
    });
  }
  if (changes.length === 0) return { text, changes };
  const lines = document.toString(serialisation).split("\n");
  const rebuilt = `---${eol}${lines.join(eol)}---${closing}`;
  return { text: rebuilt + text.slice(whole.length), changes };
}
