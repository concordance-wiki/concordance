import type { Finding } from "@concordance-wiki/core";
import type { List, Nodes, RootContent } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { parse as parseYaml, type YAMLParseError } from "yaml";

import { scannableUnits } from "./scannable.js";
import { plainText } from "./text.js";
import type { MarkdownListItem, MarkdownSection, ParseContext, ParsedMarkdown } from "./types.js";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);

type Position = NonNullable<Nodes["position"]>;

function positionOf(node: Nodes): Position {
  // remark-parse positions every node it produces; the field is optional only for synthetic trees.
  return node.position as Position;
}

function invalidFrontmatter(path: string, detail: string): Finding {
  return {
    check: "E-FM-INVALID",
    severity: "error",
    path,
    line: 1,
    message: `frontmatter of ${path} is not valid YAML: ${detail}`,
    remediation: "Fix the YAML; quote values that contain ':' or '#'. The body is still processed.",
  };
}

function readFrontmatter(text: string, path: string, findings: Finding[]): Record<string, unknown> {
  let value: unknown;
  try {
    value = parseYaml(text);
  } catch (error) {
    findings.push(
      invalidFrontmatter(path, (error as YAMLParseError).message.split("\n", 1).join("")),
    );
    return {};
  }
  if (value === null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    findings.push(invalidFrontmatter(path, "the frontmatter is not a mapping"));
    return {};
  }
  // A YAML mapping parses to a plain object keyed by strings.
  return value as Record<string, unknown>;
}

function listItems(list: List): MarkdownListItem[] {
  return list.children.map((item) => {
    const entry: MarkdownListItem = {
      text: item.children
        .filter((child) => child.type !== "list")
        .map(plainText)
        .join("\n"),
      ordered: list.ordered === true,
      line: positionOf(item).start.line,
    };
    if (typeof item.checked === "boolean") {
      entry.checked = item.checked;
    }
    return entry;
  });
}

function cells(row: { children: Nodes[] }): string[] {
  return row.children.map(plainText);
}

function collect(block: RootContent, into: ParsedMarkdown, section?: string): void {
  visit(block, (node) => {
    const { start, end } = positionOf(node);
    switch (node.type) {
      case "link":
        into.links.push({
          text: plainText(node),
          target: node.url,
          line: start.line,
          column: start.column,
        });
        break;
      case "image":
        into.images.push({ alt: plainText(node), target: node.url, line: start.line });
        break;
      case "code":
        into.codeBlocks.push({
          line: start.line,
          endLine: end.line,
          ...(typeof node.lang === "string" ? { language: node.lang } : {}),
        });
        break;
      case "blockquote":
        into.quotes.push({ line: start.line, text: plainText(node) });
        break;
      case "table": {
        const [header, ...rows] = node.children.map(cells);
        // A GFM table always carries a header row.
        into.tables.push({ line: start.line, header: header as string[], rows });
        break;
      }
      case "paragraph":
        into.paragraphs.push({
          line: start.line,
          text: plainText(node),
          ...(section === undefined ? {} : { section }),
        });
        break;
      default:
        break;
    }
  });
}

export function parseMarkdown(text: string, context: ParseContext): ParsedMarkdown {
  const root = processor.parse(text);
  const document: ParsedMarkdown = {
    frontmatter: {},
    title: undefined,
    sections: [],
    links: [],
    images: [],
    codeBlocks: [],
    quotes: [],
    tables: [],
    paragraphs: [],
    scannable: scannableUnits(root),
    findings: [],
  };
  let section: MarkdownSection | undefined;
  for (const block of root.children) {
    if (block.type === "yaml") {
      document.frontmatter = readFrontmatter(block.value, context.path, document.findings);
      continue;
    }
    if (block.type === "heading" && block.depth === 1) {
      section = undefined;
      document.title ??= plainText(block);
    } else if (block.type === "heading" && block.depth === 2) {
      section = {
        heading: plainText(block),
        line: positionOf(block).start.line,
        text: "",
        items: [],
      };
      document.sections.push(section);
    } else if (section !== undefined) {
      const blockText = plainText(block);
      if (blockText !== "") {
        section.text = section.text === "" ? blockText : `${section.text}\n${blockText}`;
      }
      if (block.type === "list") {
        section.items.push(...listItems(block));
      }
    }
    collect(block, document, section?.heading);
  }
  return document;
}
