import type { Nodes, Root, RootContent } from "mdast";

import type { ParsedMarkdown, ScannableUnit } from "./types.js";

type Position = NonNullable<Nodes["position"]>;

function lineOf(node: Nodes): number {
  // remark-parse positions every node it produces; the field is optional only for synthetic trees.
  return (node.position as Position).start.line;
}

// GFM turns bare URLs and autolinks into links whose text is the URL itself: the text is dropped.
const urlToken = /https?:\/\/\S+|www\.\S+/g;

/** The readable text of an inline node: no inline code, no raw HTML, no link or image target. */
function visibleText(node: Nodes): string {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type === "break") {
    return "\n";
  }
  if (!("children" in node)) {
    return "";
  }
  return node.children.map(visibleText).join("");
}

function unitOf(
  node: Nodes,
  kind: ScannableUnit["kind"],
  section: string | undefined,
  text = visibleText(node),
): ScannableUnit[] {
  const cleaned = text.replace(urlToken, "");
  if (cleaned.trim() === "") {
    return [];
  }
  return [
    { line: lineOf(node), text: cleaned, kind, ...(section === undefined ? {} : { section }) },
  ];
}

function unitsOf(
  block: RootContent,
  section: string | undefined,
  quoted: boolean,
): ScannableUnit[] {
  switch (block.type) {
    case "heading":
      return unitOf(block, "heading", section);
    case "paragraph":
      return unitOf(block, quoted ? "quote" : "paragraph", section);
    case "blockquote":
      return block.children.flatMap((child) => unitsOf(child, section, true));
    case "footnoteDefinition":
      return block.children.flatMap((child) => unitsOf(child, section, quoted));
    case "list":
      return block.children.flatMap((item) => {
        const own = item.children.filter((child) => child.type !== "list");
        const nested = item.children.filter((child) => child.type === "list");
        return [
          ...unitOf(item, "list-item", section, own.map(visibleText).join("\n")),
          ...nested.flatMap((list) => unitsOf(list, section, quoted)),
        ];
      });
    case "table":
      return block.children.flatMap((row) =>
        row.children.flatMap((cell) => unitOf(cell, "table-cell", section)),
      );
    default:
      // Code blocks, raw HTML, frontmatter, thematic breaks and link definitions are not read.
      return [];
  }
}

/** The text units of a tree that a scan may read, excluded zones removed, in document order. */
export function scannableUnits(root: Root): ScannableUnit[] {
  const units: ScannableUnit[] = [];
  let section: string | undefined;
  for (const block of root.children) {
    if (block.type === "heading" && block.depth === 1) {
      section = undefined;
    } else if (block.type === "heading" && block.depth === 2) {
      section = visibleText(block);
    }
    units.push(...unitsOf(block, section, false));
  }
  return units;
}

/**
 * The text units of a document that a scan may read: code blocks, inline code, URLs, frontmatter,
 * raw HTML and link targets never appear; the visible text of a link does.
 */
export function scannableText(document: ParsedMarkdown): ScannableUnit[] {
  return document.scannable.map((unit) => ({ ...unit }));
}
