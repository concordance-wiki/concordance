import type { Nodes, Root, RootContent } from "mdast";

import type { ElidedCode, ParsedMarkdown, ScannableUnit } from "./types.js";

type Position = NonNullable<Nodes["position"]>;

function lineOf(node: Nodes): number {
  // remark-parse positions every node it produces; the field is optional only for synthetic trees.
  return (node.position as Position).start.line;
}

// GFM turns bare URLs and autolinks into links whose text is the URL itself: the text is dropped.
const urlToken = /https?:\/\/\S+|www\.\S+/g;

/** A run of visible characters: read by the scan, or inline code that is only quoted. */
interface Piece {
  text: string;
  code: boolean;
}

const lineBreak: Piece = { text: "\n", code: false };

/** The visible pieces of an inline node: no raw HTML, no link or image target; inline code marked. */
function visiblePieces(node: Nodes): Piece[] {
  if (node.type === "text") {
    return [{ text: node.value, code: false }];
  }
  if (node.type === "inlineCode") {
    return [{ text: node.value, code: true }];
  }
  if (node.type === "break") {
    return [lineBreak];
  }
  if (!("children" in node)) {
    return [];
  }
  return node.children.flatMap(visiblePieces);
}

/** The readable text of an inline node, inline code left out. */
function visibleText(node: Nodes): string {
  return visiblePieces(node)
    .filter((piece) => !piece.code)
    .map((piece) => piece.text)
    .join("");
}

/** The offset once the URL spans of the text are removed: what precedes it is shortened by the removed characters before it. */
function withoutUrls(at: number, removed: readonly { start: number; end: number }[]): number {
  return removed.reduce(
    (offset, span) => offset - Math.max(0, Math.min(at, span.end) - span.start),
    at,
  );
}

function unitOf(
  node: Nodes,
  kind: ScannableUnit["kind"],
  section: string | undefined,
  pieces = visiblePieces(node),
): ScannableUnit[] {
  let text = "";
  const code: ElidedCode[] = [];
  for (const piece of pieces) {
    if (piece.code) {
      code.push({ at: text.length, text: piece.text });
    } else {
      text += piece.text;
    }
  }
  const removed = [...text.matchAll(urlToken)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  const cleaned = text.replace(urlToken, "");
  if (cleaned.trim() === "") {
    return [];
  }
  return [
    {
      line: lineOf(node),
      text: cleaned,
      kind,
      ...(section === undefined ? {} : { section }),
      ...(code.length === 0
        ? {}
        : { code: code.map((span) => ({ ...span, at: withoutUrls(span.at, removed) })) }),
    },
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
          ...unitOf(
            item,
            "list-item",
            section,
            own.flatMap((child, index) => [
              ...(index === 0 ? [] : [lineBreak]),
              ...visiblePieces(child),
            ]),
          ),
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
 * raw HTML and link targets never appear; the visible text of a link does. The inline code a
 * unit leaves out is kept aside with its offset, for a citation to quote the unit as written.
 */
export function scannableText(document: ParsedMarkdown): ScannableUnit[] {
  return document.scannable.map((unit) => ({
    ...unit,
    ...(unit.code === undefined ? {} : { code: unit.code.map((span) => ({ ...span })) }),
  }));
}
