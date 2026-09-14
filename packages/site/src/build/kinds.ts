import { message, type SiteContext } from "./context.js";

/** The kinds of files the page names from the extension; any other format is named by its extension. */
const DOCUMENT_KINDS: Readonly<
  Record<string, "presentation" | "text" | "spreadsheet" | "pdf" | "markdown">
> = {
  pptx: "presentation",
  ppt: "presentation",
  odp: "presentation",
  docx: "text",
  doc: "text",
  odt: "text",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  ods: "spreadsheet",
  pdf: "pdf",
  markdown: "markdown",
  md: "markdown",
};

/** The kind of a file worded in the site language, from its format: "Presentation", "Markdown note", "VTT" for a format the page has no word for. */
export function kindOf(context: SiteContext, format: string): string {
  const kind = DOCUMENT_KINDS[format];
  return kind === undefined ? format.toUpperCase() : message(context, `document.kind.${kind}`);
}
