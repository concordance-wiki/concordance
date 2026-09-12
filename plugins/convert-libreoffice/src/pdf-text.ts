import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** The text items of every page, in reading order, joined by spaces; a PDF that cannot be parsed reads as empty. */
export async function extractPdfText(pdf: Uint8Array): Promise<string> {
  // pdf.js keeps a reference to the buffer it is given, so a copy protects the caller's bytes.
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      // Marked-content items only appear when `includeMarkedContent` is set; every item here is text.
      pages.push(content.items.map((item) => (item as { str: string }).str).join(" "));
    }
    return pages.join("\n");
  } catch {
    return "";
  } finally {
    await task.destroy();
  }
}
