/*
 * The skeleton of a rendered page: its elements in document order, one per line, indented by
 * depth, with the attributes that shape it, the classes, the role, the ARIA attributes, the
 * island name and the served state of a disclosure or a hidden control. Text, hrefs, sources,
 * identifiers and every other attribute are left out, so that a snapshot of it changes when the
 * structure does and not when a fixture is reworded.
 */

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

/** Elements whose content is not markup: skipped up to their closing tag. */
const RAW_ELEMENTS = new Set(["script", "style"]);

const TAG =
  /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)((?:\s+[^\s="/>]+(?:="[^"]*")?)*)\s*(\/?)>/gi;

const ATTRIBUTE = /([^\s="/>]+)(?:="([^"]*)")?/g;

function kept(name: string): boolean {
  return (
    name === "class" ||
    name === "role" ||
    name.startsWith("aria-") ||
    name === "data-island" ||
    name === "hidden" ||
    name === "open"
  );
}

/** The opening tag of the skeleton: the name and the kept attributes, in source order. */
function line(name: string, attributes: string): string {
  const shown: string[] = [];
  for (const match of attributes.matchAll(ATTRIBUTE)) {
    // The first group is unconditional in the pattern: a match always carries it.
    const attribute = (match[1] as string).toLowerCase();
    if (!kept(attribute)) continue;
    shown.push(match[2] === undefined ? attribute : `${attribute}="${match[2]}"`);
  }
  return `<${name}${shown.map((attribute) => ` ${attribute}`).join("")}>`;
}

/**
 * The skeleton of a page, deterministic: the same HTML gives the same lines. A stray closing
 * tag is ignored; one that closes an element higher up closes what it holds.
 */
export function skeletonOf(html: string): string {
  const lines: string[] = [];
  const open: string[] = [];
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(html)) !== null) {
    const closing = match[1]?.toLowerCase();
    if (closing !== undefined) {
      const index = open.lastIndexOf(closing);
      if (index >= 0) open.length = index;
      continue;
    }
    const name = match[2]?.toLowerCase();
    if (name === undefined) continue;
    // The attributes group matches the empty string when a tag has none: it is always present.
    lines.push(`${"  ".repeat(open.length)}${line(name, match[3] as string)}`);
    if (VOID_ELEMENTS.has(name) || match[4] === "/") continue;
    if (RAW_ELEMENTS.has(name)) {
      const end = html.indexOf(`</${name}`, TAG.lastIndex);
      if (end >= 0) TAG.lastIndex = end;
      continue;
    }
    open.push(name);
  }
  return `${lines.join("\n")}\n`;
}
