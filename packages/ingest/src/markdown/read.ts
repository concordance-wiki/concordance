import type { FileSystem } from "@concordance-wiki/core";

import { parseMarkdown } from "./parse.js";
import type { ReadMarkdownResult } from "./types.js";

const strictDecoder = new TextDecoder("utf-8", { fatal: true });

/** Reads and parses one markdown file; a file that is not UTF-8 gives an `E-ENCODING` finding instead. */
export function readMarkdown(
  deps: { fs: FileSystem },
  absolutePath: string,
  relativePath: string,
): ReadMarkdownResult {
  const bytes = deps.fs.readBytes(absolutePath);
  let text: string;
  try {
    text = strictDecoder.decode(bytes);
  } catch {
    return {
      ok: false,
      finding: {
        check: "E-ENCODING",
        severity: "error",
        path: relativePath,
        message: `${relativePath} is not valid UTF-8; the file is skipped`,
        remediation: "Convert the file to UTF-8 without a byte order mark, or exclude it.",
      },
    };
  }
  return { ok: true, document: parseMarkdown(text, { path: relativePath }) };
}
