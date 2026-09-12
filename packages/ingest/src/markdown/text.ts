import type { Nodes } from "mdast";

/** Node types whose children are blocks, joined by line breaks in the plain text. */
const blockContainers = new Set<Nodes["type"]>([
  "blockquote",
  "list",
  "listItem",
  "table",
  "footnoteDefinition",
]);

/** The readable text of a node: no code block, no raw HTML, no link target. */
export function plainText(node: Nodes): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value;
  }
  if (node.type === "image" || node.type === "imageReference") {
    // mdast-util-from-markdown always sets alt, empty when the label is empty.
    return node.alt as string;
  }
  if (node.type === "break") {
    return "\n";
  }
  if (!("children" in node)) {
    return "";
  }
  const parts = node.children.map(plainText);
  if (blockContainers.has(node.type)) {
    return parts.filter((part) => part !== "").join("\n");
  }
  return parts.join(node.type === "tableRow" ? " " : "");
}
