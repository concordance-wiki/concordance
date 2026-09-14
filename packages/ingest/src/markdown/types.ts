import type { Finding } from "@concordance-wiki/core";

export interface ParseContext {
  /** Forward-slash path of the file, relative to the source root. */
  path: string;
}

export interface MarkdownListItem {
  /** Plain text of the item, nested lists excluded. */
  text: string;
  ordered: boolean;
  line: number;
  /** Present on task list items only. */
  checked?: boolean;
}

export interface MarkdownSection {
  heading: string;
  line: number;
  /** Plain text of everything under the heading until the next H1 or H2, code blocks excluded. */
  text: string;
  /** Items of the lists placed directly under the heading, nested lists excluded. */
  items: MarkdownListItem[];
}

export interface MarkdownLink {
  text: string;
  /** The target as written, anchor included. */
  target: string;
  line: number;
  column: number;
}

export interface MarkdownImage {
  alt: string;
  target: string;
  line: number;
}

export interface MarkdownCodeBlock {
  line: number;
  endLine: number;
  language?: string;
}

export interface MarkdownQuote {
  line: number;
  text: string;
}

export interface MarkdownTable {
  line: number;
  header: string[];
  rows: string[][];
}

export interface MarkdownParagraph {
  line: number;
  text: string;
  /** Heading of the enclosing H2 section, when any. */
  section?: string;
}

/** An inline code span left out of the text of a unit: what was written, at the offset it stood at. */
export interface ElidedCode {
  /** Offset in the text of the unit where the code stood; the code precedes the character there. */
  at: number;
  text: string;
}

/** A text unit a scan may read, excluded zones removed. */
export interface ScannableUnit {
  /** Line of the first character of the unit in the file. */
  line: number;
  /** The visible text; positions reported by a scan are relative to it. */
  text: string;
  /**
   * The inline code spans the text leaves out, in text order, so that a citation can quote the
   * unit as written; absent when the unit holds none.
   */
  code?: ElidedCode[];
  /** Heading of the enclosing H2 section, when any. */
  section?: string;
  kind: "paragraph" | "heading" | "list-item" | "table-cell" | "quote";
}

/** What one markdown file gives to the next steps; every list is in document order. */
export interface ParsedMarkdown {
  /** Empty when the file has no frontmatter or an invalid one. */
  frontmatter: Record<string, unknown>;
  /** Text of the first H1. */
  title: string | undefined;
  sections: MarkdownSection[];
  links: MarkdownLink[];
  images: MarkdownImage[];
  codeBlocks: MarkdownCodeBlock[];
  quotes: MarkdownQuote[];
  tables: MarkdownTable[];
  /** Every paragraph, list items and quotes included. */
  paragraphs: MarkdownParagraph[];
  /** The text units a scan may read: no code, no URL, no frontmatter, no link target. */
  scannable: ScannableUnit[];
  findings: Finding[];
}

export interface LinkContext {
  /** Forward-slash path of the file holding the link, relative to the source root. */
  path: string;
  /** Every file of the source, as forward-slash paths relative to its root. */
  sourceFiles: ReadonlySet<string>;
}

export type ResolvedLink =
  | { kind: "internal"; path: string; anchor?: string }
  | { kind: "external"; url: string }
  | { kind: "missing"; path: string; anchor?: string };

export type ReadMarkdownResult =
  { ok: true; document: ParsedMarkdown } | { ok: false; finding: Finding };
