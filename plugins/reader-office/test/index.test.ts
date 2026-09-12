import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import plugin, { extensions, read } from "../src/index.js";
import { docx, latin1, pdf, pptx, xlsx, zip } from "./fixtures.js";

const sources = resolve(fileURLToPath(import.meta.url), "../../src");

describe("the reader-office plugin", () => {
  it("contributes one reader for .docx, .pptx, .xlsx and .pdf", () => {
    expect(plugin.name).toBe("@concordance-wiki/plugin-reader-office");
    expect(plugin.apiVersion).toBe("1");
    expect(plugin.contributes.readers).toEqual([{ extensions, read }]);
    expect(extensions).toEqual([".docx", ".pptx", ".xlsx", ".pdf"]);
  });

  it("extracts title, author, subject, keywords, dates, page and word counts from Office properties", () => {
    const output = read({ path: "docs/review.docx", payload: { bytes: docx() } });
    expect(output.metadata).toEqual({
      title: "Quarterly review & outlook",
      author: "Alex Author",
      subject: "Planning",
      keywords: ["budget", "forecast", "review"],
      created: "2024-01-02T03:04:05Z",
      modified: "2024-02-03T04:05:06Z",
      lastModifiedBy: "Robin Reviewer",
      pages: 12,
      words: 3456,
      application: "Example Writer",
    });
    expect(read({ path: "sheets/plan.XLSX", payload: { bytes: xlsx() } }).metadata).toMatchObject({
      title: "Quarterly review & outlook",
      application: "Example Sheets",
    });
  });

  it("for pptx: slide count and slide titles", () => {
    expect(read({ path: "deck.pptx", payload: { bytes: pptx() } }).metadata).toMatchObject({
      slides: 3,
      slideTitles: ["Welcome", "Agenda", "Closing remarks"],
    });
  });

  it("for PDF: native metadata and page count", () => {
    expect(read({ path: "report.pdf", payload: { bytes: pdf() } }).metadata).toEqual({
      title: "Quarterly review (final)",
      author: "Alex Author",
      subject: "Planning",
      keywords: ["budget", "forecast", "review"],
      created: "2024-01-02T03:04:05+02:00",
      modified: "2024-02-03T04:05:06Z",
      pages: 2,
    });
  });

  it("distinguishes the document dates from the git commit date: the reader never reads git or the file system", () => {
    // The dates are the document's own, so the same bytes give the same dates under any path.
    const first = read({ path: "a/review.docx", payload: { bytes: docx() } }).metadata;
    const second = read({ path: "b/other-name.docx", payload: { bytes: docx() } }).metadata;
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      created: "2024-01-02T03:04:05Z",
      modified: "2024-02-03T04:05:06Z",
    });
    // The commit date lives on the ingested file: no source of the plugin touches git, the file system or the clock.
    const forbidden = ["node:fs", "node:child_process", "node:process", "Date.now", "new Date("];
    for (const name of readdirSync(sources)) {
      const source = readFileSync(join(sources, name), "utf8");
      expect(
        forbidden.filter((token) => source.includes(token)),
        name,
      ).toEqual([]);
    }
  });

  it("extracted authors go through pseudonymisation when it is enabled: the reader returns them raw", () => {
    const { metadata } = read({ path: "review.docx", payload: { bytes: docx() } });
    expect(metadata["author"]).toBe("Alex Author");
    expect(metadata["lastModifiedBy"]).toBe("Robin Reviewer");
  });

  it("leaves the text empty: extraction belongs to a later story", () => {
    expect(read({ path: "review.docx", payload: { bytes: docx() } }).text).toBe("");
    expect(read({ path: "report.pdf", payload: { bytes: pdf() } }).text).toBe("");
  });

  it("refuses an unknown extension with a clear error", () => {
    expect(() => read({ path: "notes/readme.txt", payload: { bytes: docx() } })).toThrow(
      'notes/readme.txt: unsupported extension ".txt"; reader-office reads .docx, .pptx, .xlsx, .pdf',
    );
  });

  it("throws a plain error naming the file when the bytes cannot be read", () => {
    const corrupted = zip({ "docProps/core.xml": "<cp:coreProperties/>" }).slice(0, 20);
    expect(() => read({ path: "decks/broken.pptx", payload: { bytes: corrupted } })).toThrow(
      /^decks\/broken\.pptx: cannot read the \.pptx file: .*zip/,
    );
    expect(() => read({ path: "scan.pdf", payload: { bytes: latin1("nope") } })).toThrow(
      "scan.pdf: cannot read the .pdf file: not a PDF file: the header is missing",
    );
  });
});
