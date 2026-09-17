import { describe, expect, it } from "vitest";

import { isoDate, PDF_SCAN_LIMIT_BYTES, readPdf } from "../src/pdf.js";
import { latin1, pdf } from "./fixtures.js";

describe("readPdf", () => {
  it("reads the native metadata and the page count of a PDF", () => {
    expect(readPdf(pdf())).toEqual({
      title: "Quarterly review (final)",
      author: "Alex Author",
      subject: "Planning",
      keywords: ["budget", "forecast", "review"],
      created: "2024-01-02T03:04:05+02:00",
      modified: "2024-02-03T04:05:06Z",
      pages: 2,
    });
  });

  it("converts PDF dates to ISO 8601 and keeps a date in another form as it is", () => {
    expect(isoDate("D:20240102030405+02'00'")).toBe("2024-01-02T03:04:05+02:00");
    expect(isoDate("D:20240102030405-05'30")).toBe("2024-01-02T03:04:05-05:30");
    expect(isoDate("D:2024010203+02")).toBe("2024-01-02T03:00:00+02:00");
    expect(isoDate("D:20240102Z")).toBe("2024-01-02T00:00:00Z");
    expect(isoDate("D:2024")).toBe("2024-01-01T00:00:00");
    expect(isoDate("20240102030405")).toBe("2024-01-02T03:04:05");
    expect(isoDate(" Tuesday ")).toBe("Tuesday");
  });

  it("decodes escapes, nested parentheses and octal codes in literal strings", () => {
    const info = "/Title (a\\(b\\)\\\\c\\n\\r\\t\\b\\f\\101\\\nd (nested (deep)) e\\q)";
    expect(readPdf(pdf(info)).title).toBe("a(b)\\c\n\r\t\b\fAd (nested (deep)) eq");
  });

  it("decodes hexadecimal strings, padding an odd final digit, and UTF-16 strings", () => {
    expect(readPdf(pdf("/Title <48 65 6C 6C 6F 7>")).title).toBe("Hellop");
    expect(readPdf(pdf("/Title <FEFF00E9007400E9>")).title).toBe("\u00e9t\u00e9");
    expect(readPdf(pdf("/Title (\u00fe\u00ff\u0000\u00e9)")).title).toBe("\u00e9");
    expect(readPdf(pdf("/Author <4142")).author).toBe("AB");
  });

  it("ignores a property given as an indirect reference or left blank", () => {
    expect(readPdf(pdf("/Title 7 0 R /Author () /Subject (  )"))).toEqual({ pages: 2 });
  });

  it("takes the Info dictionary of the last trailer when the file was updated", () => {
    const updated = pdf(undefined, "6 0 obj << /Title (Second) >>\ntrailer << /Info 6 0 R >>");
    expect(readPdf(updated).title).toBe("Second");
  });

  it("takes the last Info object when an update rewrote it under the same number", () => {
    const rewritten = pdf(
      undefined,
      "5 0 obj << /Title (Rewritten) >> endobj\ntrailer << /Info 5 0 R >>",
    );
    expect(readPdf(rewritten).title).toBe("Rewritten");
  });

  it("reads an Info dictionary referenced by a cross-reference stream", () => {
    const bytes = latin1(
      "%PDF-1.5\n1 0 obj << /Title (Streamed) >> endobj\n2 0 obj << /Type /XRef /Info 1 0 R >> stream\nendstream endobj",
    );
    expect(readPdf(bytes)).toEqual({ title: "Streamed" });
  });

  it("reads a file over the scan limit from its tail alone, its metadata found, its pages not counted", () => {
    const head = latin1("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n");
    const tail = latin1(
      "\n5 0 obj << /Title (Huge scan) >> endobj\ntrailer << /Info 5 0 R >>\n%%EOF\n",
    );
    const bytes = new Uint8Array(PDF_SCAN_LIMIT_BYTES + 1);
    bytes.set(head, 0);
    bytes.set(tail, bytes.byteLength - tail.byteLength);
    expect(readPdf(bytes)).toEqual({ title: "Huge scan" });
    const long = "x".repeat(200_000);
    expect(readPdf(pdf(`/Title (${long})`)).title).toBe(long);
  });

  it("yields no property when the file references no Info dictionary or a missing object", () => {
    expect(readPdf(latin1("%PDF-1.4\n3 0 obj << /Type /Page >> endobj"))).toEqual({ pages: 1 });
    expect(readPdf(latin1("%PDF-1.4\ntrailer << /Info 9 0 R >>"))).toEqual({});
  });

  it("does not count the page tree node as a page", () => {
    expect(readPdf(latin1("%PDF-1.4\n2 0 obj << /Type /Pages /Count 5 >> endobj"))).toEqual({});
  });

  it("refuses bytes without the PDF header", () => {
    expect(() => readPdf(latin1("PK not a pdf"))).toThrow("not a PDF file: the header is missing");
  });
});
