import { extname } from "node:path";

import {
  definePlugin,
  PLUGIN_API_VERSION,
  type ReaderInput,
  type ReaderOutput,
} from "@concordance-wiki/core";

import { readFailure } from "./failure.js";
import { readOoxml, type OoxmlKind } from "./ooxml.js";
import { readPdf } from "./pdf.js";

export type { OfficeMetadata } from "./metadata.js";
export { readOoxml, type OoxmlKind } from "./ooxml.js";
export { isoDate, readPdf } from "./pdf.js";

export const extensions = [".docx", ".pptx", ".xlsx", ".pdf"];

const ooxmlKinds: Record<string, OoxmlKind> = { ".docx": "docx", ".pptx": "pptx", ".xlsx": "xlsx" };

/**
 * Reads the native metadata of an office file from its bytes alone; the dates are the document's
 * own, distinct from the commit date the ingested file carries. The text stays empty: extraction
 * belongs to the conversion story. Throws a plain error naming the file when it cannot be read.
 */
export function read({ path, payload }: ReaderInput): ReaderOutput {
  const extension = extname(path).toLowerCase();
  const kind = ooxmlKinds[extension];
  if (kind === undefined && extension !== ".pdf") {
    throw new Error(
      `${path}: unsupported extension "${extension}"; reader-office reads ${extensions.join(", ")}`,
    );
  }
  try {
    const metadata = kind === undefined ? readPdf(payload.bytes) : readOoxml(payload.bytes, kind);
    return { metadata: { ...metadata }, text: "" };
  } catch (error) {
    throw readFailure(path, extension, error);
  }
}

export default definePlugin({
  name: "@concordance-wiki/plugin-reader-office",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  contributes: { readers: [{ extensions, read }] },
});
