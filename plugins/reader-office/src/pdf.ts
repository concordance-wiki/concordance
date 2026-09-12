import { Buffer } from "node:buffer";

import { compact, nonBlank, splitKeywords, type OfficeMetadata } from "./metadata.js";

// Objects stored in compressed object streams (PDF 1.5 and later) are invisible to this scan: an
// Info dictionary or page objects they hide are not seen, so the page count is a lower bound. This
// is enough for native metadata; the story that extracts text brings a full parser and takes over.

const pageObject = /\/Type\s*\/Page\b/g;
const infoReference = /\/Info\s+(\d+)\s+(\d+)\s+R\b/g;
const pdfDate =
  /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}(?:'\d{2})?)?'?$/;
const dateDefaults = ["0000", "01", "01", "00", "00", "00"];
type Property = "Title" | "Author" | "Subject" | "Keywords" | "CreationDate" | "ModDate";

const utf16 = new TextDecoder("utf-16be");
const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };

function group(match: RegExpExecArray, index: number, fallback: string): string {
  return match[index] ?? fallback;
}

/** Latin-1 keeps one character per byte, so that positions in the text are positions in the file. */
function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
}

/** Text strings are UTF-16BE when they start with a byte order mark, PDFDocEncoding otherwise. */
function decodeString(bytes: number[]): string {
  const [first, second] = bytes;
  if (first === 0xfe && second === 0xff) return utf16.decode(Uint8Array.from(bytes.slice(2)));
  return String.fromCharCode(...bytes);
}

/** Reads a literal string `(...)` starting at `start`; parentheses nest, backslash escapes. */
function literalString(text: string, start: number): string {
  const bytes: number[] = [];
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (char === "\\") {
      const next = text.charAt(i + 1);
      const octal = /^[0-7]{1,3}/.exec(text.slice(i + 1, i + 4));
      if (octal !== null) {
        bytes.push(Number.parseInt(octal[0], 8));
        i += octal[0].length;
      } else {
        // An escaped line break continues the string; any other character stands for itself.
        if (next !== "\n") bytes.push(escapes[next] ?? next.charCodeAt(0));
        i += 1;
      }
    } else if (char === "(") {
      if (depth > 0) bytes.push(40);
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) break;
      bytes.push(41);
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return decodeString(bytes);
}

/** Reads a hexadecimal string `<...>` starting at `start`; an odd final digit is padded with zero. */
function hexString(text: string, start: number): string {
  const digits = text
    .slice(start + 1)
    .replace(/[^0-9A-Fa-f\s][\s\S]*$/, "")
    .replace(/\s+/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    bytes.push(Number.parseInt(digits.slice(i, i + 2).padEnd(2, "0"), 16));
  }
  return decodeString(bytes);
}

/** The value of a string-valued key of the dictionary; an indirect reference or a missing key yields nothing. */
function stringProperty(dictionary: string, key: Property): string | undefined {
  const match = new RegExp(`/${key}\\b\\s*([(<])`).exec(dictionary);
  if (match === null) return undefined;
  const start = match.index + match[0].length - 1;
  return match[1] === "(" ? literalString(dictionary, start) : hexString(dictionary, start);
}

function offset(zone: string | undefined): string {
  if (zone === undefined) return "";
  if (zone === "Z") return "Z";
  return `${zone.slice(0, 3)}:${zone.slice(4, 6) || "00"}`;
}

/** Converts `D:YYYYMMDDHHmmSSOHH'mm'` to ISO 8601; a value in another form is kept as it is. */
export function isoDate(value: string): string {
  const match = pdfDate.exec(value.trim());
  if (match === null) return value.trim();
  // Every field after the year is optional; the specification defaults them as listed.
  const fields = dateDefaults.map((fallback, index) => group(match, index + 1, fallback));
  return `${fields.slice(0, 3).join("-")}T${fields.slice(3).join(":")}${offset(match[7])}`;
}

/** The body of the last Info object the file references: an update appends a new trailer at the end. */
function infoDictionary(text: string): string {
  const references = [...text.matchAll(infoReference)];
  const last = references[references.length - 1];
  if (last === undefined) return "";
  const number = group(last, 1, "");
  const generation = group(last, 2, "");
  const object = new RegExp(
    `(?:^|\\s)${number}\\s+${generation}\\s+obj\\b([\\s\\S]*?)(?:endobj|$)`,
  );
  const match = object.exec(text);
  return match === null ? "" : group(match, 1, "");
}

/** Reads the native metadata of a PDF: the Info dictionary and the number of page objects. */
export function readPdf(bytes: Uint8Array): OfficeMetadata {
  const text = latin1(bytes);
  if (!text.startsWith("%PDF-")) throw new Error("not a PDF file: the header is missing");
  const info = infoDictionary(text);
  const property = (key: Property) => nonBlank(stringProperty(info, key));
  const created = property("CreationDate");
  const modified = property("ModDate");
  const pages = [...text.matchAll(pageObject)].length;
  return compact({
    title: property("Title"),
    author: property("Author"),
    subject: property("Subject"),
    keywords: splitKeywords(property("Keywords")),
    created: created === undefined ? undefined : isoDate(created),
    modified: modified === undefined ? undefined : isoDate(modified),
    pages: pages === 0 ? undefined : pages,
  });
}
