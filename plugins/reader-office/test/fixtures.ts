import { Buffer } from "node:buffer";

import { strToU8, zipSync } from "fflate";

/** One byte per character, so that a test can place raw bytes such as a byte order mark. */
export const latin1 = (text: string): Uint8Array => Buffer.from(text, "latin1");

export function zip(parts: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])));
}

export const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Quarterly review &amp; outlook</dc:title>
  <dc:subject>Planning</dc:subject>
  <dc:creator>Alex Author</dc:creator>
  <cp:keywords>budget; forecast, review</cp:keywords>
  <cp:lastModifiedBy>Robin Reviewer</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-01-02T03:04:05Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2024-02-03T04:05:06Z</dcterms:modified>
</cp:coreProperties>`;

export const docxAppXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Example Writer</Application>
  <Pages>12</Pages>
  <Words>3456</Words>
</Properties>`;

export const pptxAppXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Example Presenter</Application>
  <Slides>3</Slides>
  <Words>78</Words>
</Properties>`;

export function slideXml(shapes: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;
}

export function shape(placeholder: string, runs: string[]): string {
  const paragraphs = runs.map((run) => `<a:p><a:r><a:t>${run}</a:t></a:r></a:p>`).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Shape"/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:txBody>${paragraphs}</p:txBody></p:sp>`;
}

export const docx = (): Uint8Array =>
  zip({
    "[Content_Types].xml": "<Types/>",
    "docProps/core.xml": coreXml,
    "docProps/app.xml": docxAppXml,
    "word/document.xml": "<w:document/>",
  });

export const pptx = (): Uint8Array =>
  zip({
    "[Content_Types].xml": "<Types/>",
    "docProps/core.xml": coreXml,
    "docProps/app.xml": pptxAppXml,
    "ppt/presentation.xml": "<p:presentation/>",
    // Parts are listed out of order on purpose: the titles must follow the slide numbers.
    "ppt/slides/slide10.xml": slideXml(shape('<p:ph type="title"/>', ["Closing ", "remarks"])),
    "ppt/slides/slide2.xml": slideXml(
      shape('<p:ph idx="1"/>', ["Body text"]) + shape('<p:ph type="ctrTitle"/>', ["Agenda"]),
    ),
    "ppt/slides/slide1.xml": slideXml(shape('<p:ph type="title"/>', ["Welcome"])),
  });

export const xlsx = (): Uint8Array =>
  zip({
    "[Content_Types].xml": "<Types/>",
    "docProps/core.xml": coreXml,
    "docProps/app.xml": `<Properties><Application>Example Sheets</Application></Properties>`,
    "xl/workbook.xml": "<workbook/>",
  });

/** A PDF with an Info dictionary and two pages; `info` replaces the dictionary body, `update` is appended. */
export function pdf(info?: string, update = ""): Uint8Array {
  const dictionary =
    info ??
    "/Title (Quarterly review \\(final\\)) /Author (Alex Author) /Subject (Planning) /Keywords (budget, forecast; review) /CreationDate (D:20240102030405+02'00') /ModDate (D:20240203040506Z) /Producer (Example Writer)";
  return latin1(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R >> endobj
4 0 obj << /Type /Page /Parent 2 0 R >> endobj
5 0 obj << ${dictionary} >> endobj
trailer << /Root 1 0 R /Info 5 0 R >>
%%EOF
${update}`);
}
