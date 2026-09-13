import { slugify } from "@concordance-wiki/core";
import type { Definition, Image, Link, Nodes, Parent, Root, RootContent } from "mdast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import type { Section } from "../slots.js";

export interface MarkdownOptions {
  /**
   * The href a link, image or definition target is rewritten to; undefined keeps the target as
   * written, null drops the link (its text stays), the image or the definition, for a file of the
   * repository that has no page.
   */
  resolveHref?: (target: string) => string | null | undefined;
}

export interface RenderedMarkdown {
  /** Text of the first H1, which titles the page and is left out of the sections. */
  title?: string;
  /** The lead before the first H2, when there is one, then one section per H1 or H2. */
  sections: Section[];
}

/** Identifier of the section before the first heading; every other section is `section-<slug>`. */
export const LEAD_SECTION_ID = "section-lead";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
// Raw HTML is dropped and the remaining tree is sanitised: a note never injects markup or scripts in a page.
const compiler = unified()
  .use(remarkRehype)
  .use(rehypeSanitize, defaultSchema)
  .use(rehypeStringify);

function textOf(node: Nodes): string {
  if ("value" in node) {
    return node.value;
  }
  return "children" in node ? node.children.map(textOf).join("") : "";
}

function replacement(node: Link | Image | Definition): RootContent[] {
  return node.type === "link" ? node.children : [];
}

/** Rewrites the targets under a node, depth first; a dropped link leaves its children in its place. */
function rewriteTargets(
  parent: Parent,
  resolveHref: NonNullable<MarkdownOptions["resolveHref"]>,
): void {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === "link" || child.type === "image" || child.type === "definition") {
      const resolved = resolveHref(child.url);
      if (resolved === null) {
        return replacement(child);
      }
      child.url = resolved ?? child.url;
    }
    if ("children" in child) {
      rewriteTargets(child, resolveHref);
    }
    return [child];
  });
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
  if (options.resolveHref !== undefined) {
    rewriteTargets(tree, options.resolveHref);
  }
  const sections: Section[] = [];
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
    if (node.type === "heading" && node.depth <= 2) {
      close();
      const heading = textOf(node);
      current = { id: uniqueId(`section-${slugify(heading)}`, taken), heading, nodes: [] };
      continue;
    }
    current.nodes.push(node);
  }
  close();
  return { ...(title === undefined ? {} : { title }), sections };
}
