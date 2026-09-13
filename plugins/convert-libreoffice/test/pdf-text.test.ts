import { describe, expect, it } from "vitest";

import { extractPdfPages, extractPdfText } from "../src/pdf-text.js";

const encoder = new TextEncoder();

/** A minimal PDF, one page per content stream; pdf.js rebuilds the missing cross-reference table. */
function pdf(contents: string[]): Uint8Array {
  const kids = contents.map((_, index) => `${String(4 + index * 2)} 0 R`).join(" ");
  const pages = contents.flatMap((content, index) => {
    const page = 4 + index * 2;
    return [
      `${String(page)} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents ${String(page + 1)} 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj`,
      `${String(page + 1)} 0 obj << /Length ${String(content.length)} >> stream\n${content}\nendstream endobj`,
    ];
  });
  return encoder.encode(
    [
      "%PDF-1.4",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${String(contents.length)} >> endobj`,
      "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      ...pages,
      "trailer << /Root 1 0 R >>",
      "%%EOF",
    ].join("\n"),
  );
}

describe("extractPdfPages", () => {
  it("gives the text of every page, in page order", async () => {
    const pages = await extractPdfPages(
      pdf([
        "BT /F1 12 Tf 20 100 Td (Build) Tj ( summary) Tj ET",
        "BT /F1 12 Tf 20 100 Td (Second slide) Tj ET",
      ]),
    );
    expect(pages).toEqual(["Build summary", "Second slide"]);
  });

  it("keeps a page without text as an empty entry, so that page numbers stay right", async () => {
    expect(
      await extractPdfPages(
        pdf(["0 0 1 rg 10 10 50 50 re f", "BT /F1 12 Tf 20 100 Td (Two) Tj ET"]),
      ),
    ).toEqual(["", "Two"]);
  });

  it("has no page for bytes that are not a PDF", async () => {
    expect(await extractPdfPages(encoder.encode("not a pdf at all"))).toEqual([]);
  });
});

describe("extractPdfText", () => {
  it("joins the text items of every page, one line per page", async () => {
    const text = await extractPdfText(
      pdf([
        "BT /F1 12 Tf 20 100 Td (Hello) Tj ( world) Tj ET",
        "BT /F1 12 Tf 20 100 Td (Second) Tj ET",
      ]),
    );
    expect(text).toBe("Hello world\nSecond");
  });

  it("is empty for a PDF whose pages draw no text", async () => {
    expect(await extractPdfText(pdf(["0 0 1 rg 10 10 50 50 re f"]))).toBe("");
  });

  it("is empty for bytes that are not a PDF", async () => {
    expect(await extractPdfText(encoder.encode("not a pdf at all"))).toBe("");
  });

  it("leaves the given bytes untouched", async () => {
    const bytes = pdf(["BT /F1 12 Tf 20 100 Td (Kept) Tj ET"]);
    const copy = Uint8Array.from(bytes);
    await extractPdfText(bytes);
    expect([...bytes]).toEqual([...copy]);
  });
});
