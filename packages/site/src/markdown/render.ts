import { slugify } from "@concordance-wiki/core";
import type {
  Definition,
  Image,
  Link,
  LinkReference,
  Nodes,
  Paragraph,
  Parent,
  Root,
  RootContent,
  Text,
} from "mdast";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import type { Section } from "../slots.js";
import { FIGURE_CAPTION_CLASS, FIGURE_CLASS, FIGURE_PATH_CLASS } from "./figures.js";

/** Class of an anchor the author wrote whose target is a page of the site. */
export const WRITTEN_CLASS = "written";
/** Class of an anchor the build added around a word the scan recognised. */
export const RECOGNISED_CLASS = "recognised";

/** What kind of node a target was written on. */
export type TargetKind = "link" | "image" | "definition";

/** A word the scan recognised in a note, to be linked in the text. */
export interface RecognisedSpan {
  /** Line of the paragraph, list item, table row or quote the word was read in. */
  line: number;
  /** The word as written in the text. */
  text: string;
  /**
   * The page of the entity the word names; absent for a word that is passed over without a
   * link, the page's own name for instance, so that the words after it stay in step.
   */
  href?: string;
}

export interface MarkdownOptions {
  /**
   * The href a link, image or definition target is rewritten to; undefined keeps the target as
   * written, null drops the link (its text stays), the image or the definition, for a file of the
   * repository that has no page. A rewritten link or definition is marked as written.
   */
  resolveHref?: (target: string, kind: TargetKind) => string | null | undefined;
  /**
   * The recognised words of the note, in text order: each one is wrapped in a marked anchor where
   * its text is found in its unit, unless it sits inside a link already.
   */
  recognised?: readonly RecognisedSpan[];
  /**
   * The path of an image of the sources in its repository, for its target as written; undefined
   * for any other image. An image of the sources that holds a paragraph of its own is rendered as
   * a figure captioned with its alternative text and that path; an image among text stays inline.
   */
  imagePath?: (target: string) => string | undefined;
}

export interface RenderedMarkdown {
  /** Text of the first H1, which titles the page and is left out of the sections. */
  title?: string;
  /** The lead before the first H2, when there is one, then one section per H1 or H2. */
  sections: Section[];
  /** The plain text of the sections, headings included and code blocks left out, one block per line: what the search index reads. */
  text: string;
}

/** Identifier of the section before the first heading; every other section is `section-<slug>`. */
export const LEAD_SECTION_ID = "section-lead";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);

type AttributeRules = NonNullable<SanitizeSchema["attributes"]>[string];

// The default schema declares the attributes of every element it allows, anchors and code among them.
const defaultRules = defaultSchema.attributes as Record<"a" | "code", AttributeRules>;
// The default schema lists the elements it allows.
const defaultTags = defaultSchema.tagNames as string[];

/** The rules of an element, the given classes allowed on it besides the ones the default schema names. */
function withClasses(rules: AttributeRules, ...classes: string[]): AttributeRules {
  return rules.map((rule) =>
    Array.isArray(rule) && rule[0] === "className" ? [...rule, ...classes] : rule,
  );
}

// The default schema, plus the classes the build sets on anchors and on the figures of the images
// of the sources; nothing else of a note reaches a page.
const schema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...defaultTags, "figure", "figcaption"],
  attributes: {
    ...defaultSchema.attributes,
    a: withClasses(defaultRules.a, WRITTEN_CLASS, RECOGNISED_CLASS),
    code: withClasses(defaultRules.code, FIGURE_PATH_CLASS),
    figure: [["className", FIGURE_CLASS]],
    span: [["className", FIGURE_CAPTION_CLASS]],
  },
};

// Raw HTML is dropped and the remaining tree is sanitised: a note never injects markup or scripts in a page.
const compiler = unified().use(remarkRehype).use(rehypeSanitize, schema).use(rehypeStringify);

function textOf(node: Nodes): string {
  if ("value" in node) {
    return node.value;
  }
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** Nodes whose text is not prose: code is not searched, raw HTML is dropped from the page too. */
const SILENT = new Set<string>(["code", "html"]);

/** Nodes whose children follow one another as blocks rather than inline. */
const BLOCK_CONTAINERS = new Set<string>([
  "root",
  "list",
  "listItem",
  "blockquote",
  "table",
  "tableRow",
  "footnoteDefinition",
]);

function plainTextOf(node: Nodes): string {
  if (SILENT.has(node.type)) {
    return "";
  }
  if ("value" in node) {
    return node.value;
  }
  if (node.type === "break") {
    return " ";
  }
  if (!("children" in node)) {
    return "";
  }
  const parts = node.children.map(plainTextOf);
  return BLOCK_CONTAINERS.has(node.type) ? parts.join("\n") : parts.join("");
}

/** The prose of a list of nodes, one block per line, blank lines removed. */
export function plainText(nodes: RootContent[]): string {
  const root: Root = { type: "root", children: nodes };
  return plainTextOf(root)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

function replacement(node: Link | Image | Definition): RootContent[] {
  return node.type === "link" ? node.children : [];
}

function markAs(node: Link | LinkReference, className: string): void {
  node.data = { ...node.data, hProperties: { className: [className] } };
}

/**
 * Rewrites the targets under a node, depth first; a dropped link leaves its children in its
 * place. Returns the identifiers of the definitions that were rewritten.
 */
function rewriteTargets(
  parent: Parent,
  resolveHref: NonNullable<MarkdownOptions["resolveHref"]>,
  rewritten = new Set<string>(),
): Set<string> {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === "link" || child.type === "image" || child.type === "definition") {
      const resolved = resolveHref(child.url, child.type);
      if (resolved === null) {
        return replacement(child);
      }
      if (resolved !== undefined) {
        child.url = resolved;
        if (child.type === "link") markAs(child, WRITTEN_CLASS);
        if (child.type === "definition") rewritten.add(child.identifier);
      }
    }
    if ("children" in child) {
      rewriteTargets(child, resolveHref, rewritten);
    }
    return [child];
  });
  return rewritten;
}

function markReferences(parent: Parent, rewritten: ReadonlySet<string>): void {
  for (const child of parent.children) {
    if (child.type === "linkReference" && rewritten.has(child.identifier)) {
      markAs(child, WRITTEN_CLASS);
    }
    if ("children" in child) {
      markReferences(child, rewritten);
    }
  }
}

/** A text node and the parent that holds it, so that it can be split in place. */
interface TextSlot {
  parent: Parent;
  node: Text;
}

/** The text of one unit the scan reads: a heading, a paragraph, a list item's own text, a table cell. */
interface TextUnit {
  line: number;
  slots: TextSlot[];
}

type Position = NonNullable<Nodes["position"]>;

function lineOf(node: Nodes): number {
  // remark-parse positions every node it produces; the field is optional only for synthetic trees.
  return (node.position as Position).start.line;
}

/** The text nodes under a node, links left out: a recognised word inside a link stays as it is. */
function textSlots(parent: Parent, slots: TextSlot[] = []): TextSlot[] {
  for (const child of parent.children) {
    if (child.type === "text") {
      slots.push({ parent, node: child });
    } else if ("children" in child && child.type !== "link" && child.type !== "linkReference") {
      textSlots(child, slots);
    }
  }
  return slots;
}

/** The units of a block in document order, cut as the scan cuts them so that lines match. */
function unitsOf(block: RootContent): TextUnit[] {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return [{ line: lineOf(block), slots: textSlots(block) }];
    case "blockquote":
    case "footnoteDefinition":
      return block.children.flatMap(unitsOf);
    case "list":
      return block.children.flatMap((item) => [
        {
          line: lineOf(item),
          slots: item.children
            .filter((child) => child.type !== "list")
            .flatMap((child) => ("children" in child ? textSlots(child) : [])),
        },
        ...item.children.filter((child) => child.type === "list").flatMap(unitsOf),
      ]);
    case "table":
      return block.children.flatMap((row) =>
        row.children.map((cell) => ({ line: lineOf(cell), slots: textSlots(cell) })),
      );
    default:
      return [];
  }
}

function recognisedLink(span: RecognisedSpan, href: string): Link {
  return {
    type: "link",
    url: href,
    data: { hProperties: { className: [RECOGNISED_CLASS] } },
    children: [{ type: "text", value: span.text }],
  };
}

/**
 * Wraps the span in the first slot from `cursor` whose text holds it and returns where the next
 * search starts: past the mark, or where it was when the text is not found.
 */
function wrap(slots: TextSlot[], cursor: number, span: RecognisedSpan): number {
  for (const [index, slot] of slots.entries()) {
    if (index < cursor) continue;
    const at = slot.node.value.indexOf(span.text);
    if (at === -1) continue;
    const before = slot.node.value.slice(0, at);
    const after: Text = { type: "text", value: slot.node.value.slice(at + span.text.length) };
    const position = slot.parent.children.indexOf(slot.node);
    // A word passed over stays text; two adjacent text nodes render as one.
    const marked: RootContent =
      span.href === undefined
        ? { type: "text", value: `${before}${span.text}` }
        : recognisedLink(span, span.href);
    const pieces: RootContent[] = [
      ...(before === "" || span.href === undefined
        ? []
        : [{ type: "text", value: before } satisfies Text]),
      marked,
      ...(after.value === "" ? [] : [after]),
    ];
    slot.parent.children.splice(position, 1, ...pieces);
    if (after.value === "") {
      return index + 1;
    }
    slots[index] = { parent: slot.parent, node: after };
    return index;
  }
  return cursor;
}

/**
 * Marks every recognised word in the text of its line, in order: the cells of a table row share
 * a line and are searched in turn; a word that is not found as written (split by inline markup,
 * or inside a link) is left unmarked.
 */
function markRecognised(tree: Root, spans: readonly RecognisedSpan[]): void {
  const lines = new Map<number, TextSlot[]>();
  for (const unit of tree.children.flatMap(unitsOf)) {
    lines.set(unit.line, [...(lines.get(unit.line) ?? []), ...unit.slots]);
  }
  const cursors = new Map<number, number>();
  for (const span of spans) {
    const slots = lines.get(span.line);
    if (slots === undefined) continue;
    cursors.set(span.line, wrap(slots, cursors.get(span.line) ?? 0, span));
  }
}

/** A paragraph that holds one image and nothing else: an image at a place of its own in the text. */
interface LoneImage {
  paragraph: Paragraph;
  image: Image;
}

function loneImages(parent: Parent, found: LoneImage[] = []): LoneImage[] {
  for (const child of parent.children) {
    const only = child.type === "paragraph" ? child.children[0] : undefined;
    if (child.type === "paragraph" && child.children.length === 1 && only?.type === "image") {
      found.push({ paragraph: child, image: only });
    } else if ("children" in child) {
      loneImages(child, found);
    }
  }
  return found;
}

/** A lone image of the sources, with the path of its file in its repository. */
interface Figure extends LoneImage {
  path: string;
}

/** The lone images of the sources, their paths looked up on the targets as written. */
function figuresOf(tree: Root, imagePath: NonNullable<MarkdownOptions["imagePath"]>): Figure[] {
  return loneImages(tree).flatMap((lone) => {
    const path = imagePath(lone.image.url);
    return path === undefined ? [] : [{ ...lone, path }];
  });
}

type HastChild = NonNullable<NonNullable<Paragraph["data"]>["hChildren"]>[number];

function hastElement(
  tagName: string,
  properties: Record<string, string | string[]>,
  children: HastChild[],
): HastChild {
  return { type: "element", tagName, properties, children };
}

/**
 * Turns the paragraph of a lone image of the sources into a figure: the image, then a caption
 * made of its alternative text when it has one and of the path of its file. The markup is given
 * to the compiler whole, so that the caption is neither searched nor scanned for words.
 */
function wrapFigure({ paragraph, image, path }: Figure): void {
  // remark-parse gives every image an alt, empty when none was written; the field is nullable only for synthetic trees.
  const alt = image.alt as string;
  paragraph.data = {
    hName: "figure",
    hProperties: { className: [FIGURE_CLASS] },
    hChildren: [
      hastElement("img", { src: image.url, alt }, []),
      hastElement("figcaption", {}, [
        ...(alt === ""
          ? []
          : [
              hastElement("span", { className: [FIGURE_CAPTION_CLASS] }, [
                { type: "text", value: alt },
              ]),
            ]),
        hastElement("code", { className: [FIGURE_PATH_CLASS] }, [{ type: "text", value: path }]),
      ]),
    ],
  };
}

interface OpenSection {
  id: string;
  heading?: string;
  nodes: RootContent[];
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let rank = 2; taken.has(id); rank += 1) {
    id = `${base}-${String(rank)}`;
  }
  taken.add(id);
  return id;
}

function toHtml(nodes: RootContent[]): string {
  const root: Root = { type: "root", children: nodes };
  return compiler.stringify(compiler.runSync(root));
}

/**
 * A note as the entity page shows it: the frontmatter and the first H1 removed, the body split
 * into sections at every H1 or H2, each rendered to sanitised HTML.
 */
export function renderMarkdown(text: string, options: MarkdownOptions = {}): RenderedMarkdown {
  const tree = parser.parse(text);
  // The paths are looked up before the targets are rewritten, the figures built after: the image keeps its page href.
  const figures = options.imagePath === undefined ? [] : figuresOf(tree, options.imagePath);
  if (options.resolveHref !== undefined) {
    markReferences(tree, rewriteTargets(tree, options.resolveHref));
  }
  if (options.recognised !== undefined) {
    markRecognised(tree, options.recognised);
  }
  for (const figure of figures) {
    wrapFigure(figure);
  }
  const sections: Section[] = [];
  const body: RootContent[] = [];
  const taken = new Set<string>();
  let title: string | undefined;
  let current: OpenSection = { id: LEAD_SECTION_ID, nodes: [] };
  const close = (): void => {
    if (current.heading === undefined && current.nodes.length === 0) {
      return;
    }
    const section: Section = { id: current.id, html: toHtml(current.nodes) };
    if (current.heading !== undefined) {
      section.heading = current.heading;
    }
    sections.push(section);
  };
  for (const node of tree.children) {
    if (node.type === "yaml") {
      continue;
    }
    if (node.type === "heading" && node.depth === 1 && title === undefined) {
      title = textOf(node);
      continue;
    }
    body.push(node);
    if (node.type === "heading" && node.depth <= 2) {
      close();
      const heading = textOf(node);
      current = { id: uniqueId(`section-${slugify(heading)}`, taken), heading, nodes: [] };
      continue;
    }
    current.nodes.push(node);
  }
  close();
  return { ...(title === undefined ? {} : { title }), sections, text: plainText(body) };
}
