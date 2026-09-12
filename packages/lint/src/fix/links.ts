import { posix } from "node:path";

import {
  parseMarkdown,
  resolveLink,
  type LinkContext,
  type MarkdownLink,
} from "@concordance-wiki/ingest";

import { leavesRoot } from "../local.js";
import type { FixChange, FixRefusal } from "./types.js";

interface Edit {
  offset: number;
  length: number;
  replacement: string;
}

/** Offset of the first character of a link, from the 1-based line and column remark reports. */
function offsetOf(text: string, link: MarkdownLink): number {
  let offset = 0;
  for (let line = 1; line < link.line; line += 1) {
    offset = text.indexOf("\n", offset) + 1;
  }
  return offset + link.column - 1;
}

/** Files carrying the same name and extension as the missing target, wherever they are filed. */
function candidatesFor(missing: string, files: ReadonlySet<string>): string[] {
  const wanted = posix.parse(missing);
  return [...files]
    .filter((file) => {
      const parsed = posix.parse(file);
      return parsed.name === wanted.name && parsed.ext === wanted.ext;
    })
    .sort();
}

function destination(from: string, file: string, anchor: string | undefined): string {
  const relative = posix.relative(posix.dirname(from), file);
  // A destination with a space or a parenthesis only parses between angle brackets.
  const written = /[\s()]/.test(relative) ? `<${relative}>` : relative;
  return anchor === undefined ? written : `${written}#${anchor}`;
}

/**
 * Locates `](target` for the link, before the next link starts and followed by `)` or a title; a
 * destination written between angle brackets or padded with spaces is not rewritten.
 */
function locate(text: string, link: MarkdownLink, limit: number): number | undefined {
  const needle = `](${link.target}`;
  let written = text.indexOf(needle, offsetOf(text, link));
  while (written !== -1 && written < limit) {
    const end = written + needle.length;
    if (/^[\s)]$/.test(text.slice(end, end + 1))) return written + 2;
    written = text.indexOf(needle, end);
  }
  return undefined;
}

/**
 * Rewrites every link to a missing file when exactly one file of the source carries that name and
 * extension; several such files are a refusal, none leaves the finding in place. Only the destination
 * characters of the link are replaced.
 */
export function rewriteRenamedLinks(
  text: string,
  context: LinkContext,
): { text: string; changes: FixChange[]; refused: FixRefusal[] } {
  const { path } = context;
  const { links } = parseMarkdown(text, { path });
  const changes: FixChange[] = [];
  const refused: FixRefusal[] = [];
  const edits: Edit[] = [];
  links.forEach((link, index) => {
    const resolved = resolveLink(link.target, context);
    if (resolved.kind !== "missing" || leavesRoot(resolved.path)) return;
    const candidates = candidatesFor(resolved.path, context.sourceFiles);
    const [file, ...others] = candidates;
    if (file === undefined) return;
    if (others.length > 0) {
      refused.push({
        path,
        line: link.line,
        description: `link "${link.target}" matches several files: ${candidates.join(", ")}; choose one`,
      });
      return;
    }
    const target = destination(path, file, resolved.anchor);
    const following = links[index + 1];
    const offset = locate(
      text,
      link,
      following === undefined ? text.length : offsetOf(text, following),
    );
    if (offset === undefined) {
      refused.push({
        path,
        line: link.line,
        description: `link "${link.target}" is not written as an inline destination; point it to ${target} by hand`,
      });
      return;
    }
    edits.push({ offset, length: link.target.length, replacement: target });
    changes.push({
      kind: "link-target",
      path,
      line: link.line,
      description: `rewrite link "${link.target}" to "${target}", the only file named ${posix.basename(file)}`,
    });
  });
  let fixed = text;
  // Edits come in document order; applying them from the end keeps every earlier offset valid.
  for (const edit of edits.reverse()) {
    fixed = fixed.slice(0, edit.offset) + edit.replacement + fixed.slice(edit.offset + edit.length);
  }
  return { text: fixed, changes, refused };
}
