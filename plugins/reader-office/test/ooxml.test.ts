import { describe, expect, it } from "vitest";

import { PART_SIZE_LIMIT, readOoxml } from "../src/ooxml.js";
import { coreXml, docx, docxAppXml, pptx, shape, slideXml, xlsx, zip } from "./fixtures.js";

describe("readOoxml", () => {
  it("extracts title, author, subject, keywords, dates, page and word counts from Office properties", () => {
    expect(readOoxml(docx(), "docx")).toEqual({
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
  });

  it("inflates the property and slide parts alone, none above the size limit, so that media and an entry that inflates to gigabytes stay compressed", () => {
    const heavy = zip({
      "docProps/core.xml": coreXml,
      "docProps/app.xml": docxAppXml,
      "word/media/image1.png": "\u0000".repeat(50_000),
      "word/document.xml": "<w:document/>",
    });
    expect(readOoxml(heavy, "docx")).toMatchObject({ title: "Quarterly review & outlook" });
    const bloated = zip({
      "docProps/core.xml":
        "<cp:coreProperties>" + " ".repeat(PART_SIZE_LIMIT) + "</cp:coreProperties>",
      "docProps/app.xml": docxAppXml,
    });
    expect(readOoxml(bloated, "docx").title).toBeUndefined();
    expect(readOoxml(bloated, "docx").pages).toBeDefined();
  });

  it("refuses a part that declares a DOCTYPE, so that no entity is ever expanded", () => {
    const bomb = zip({
      "docProps/core.xml":
        '<!DOCTYPE cp [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><cp:coreProperties><dc:title>&b;</dc:title></cp:coreProperties>',
    });
    expect(() => readOoxml(bomb, "docx")).toThrow("DOCTYPE declarations are not read");
  });

  it("reads the slide count and the slide titles of a pptx", () => {
    const metadata = readOoxml(pptx(), "pptx");
    expect(metadata.slides).toBe(3);
    expect(metadata.slideTitles).toEqual(["Welcome", "Agenda", "Closing remarks"]);
    expect(metadata.words).toBe(78);
    expect(metadata.application).toBe("Example Presenter");
    expect(metadata.pages).toBeUndefined();
  });

  it("gives an empty title to a slide that has no title placeholder", () => {
    const bytes = zip({
      "docProps/app.xml": "<Properties><Slides>2</Slides></Properties>",
      "ppt/slides/slide1.xml": slideXml(shape('<p:ph type="body"/>', ["Only a body"])),
      "ppt/slides/slide2.xml": slideXml(shape('<p:ph type="title"/>', [" Spaced   title "])),
    });
    expect(readOoxml(bytes, "pptx")).toEqual({ slides: 2, slideTitles: ["", "Spaced title"] });
  });

  it("reads the properties of an xlsx and reports no slides for it", () => {
    const metadata = readOoxml(xlsx(), "xlsx");
    expect(metadata.title).toBe("Quarterly review & outlook");
    expect(metadata.application).toBe("Example Sheets");
    expect(metadata.slides).toBeUndefined();
    expect(metadata.slideTitles).toBeUndefined();
  });

  it("returns the created and modified dates as the document states them", () => {
    const metadata = readOoxml(docx(), "docx");
    expect(metadata.created).toBe("2024-01-02T03:04:05Z");
    expect(metadata.modified).toBe("2024-02-03T04:05:06Z");
  });

  it("yields empty metadata for a package without docProps", () => {
    expect(readOoxml(zip({ "word/document.xml": "<w:document/>" }), "docx")).toEqual({});
  });

  it("ignores blank properties, non-numeric counts and a properties part with another root", () => {
    const blank = zip({
      "docProps/core.xml":
        '<cp:coreProperties xmlns:cp="urn:cp" xmlns:dc="urn:dc"><dc:title>  </dc:title><dc:creator/><cp:keywords> ; ,</cp:keywords></cp:coreProperties>',
      "docProps/app.xml": "<Other><Pages>12</Pages></Other>",
    });
    expect(readOoxml(blank, "docx")).toEqual({});
    const counts = zip({
      "docProps/app.xml": "<Properties><Pages>many</Pages><Words>7</Words></Properties>",
    });
    expect(readOoxml(counts, "docx")).toEqual({ words: 7 });
  });

  it("reads the same properties whatever the namespace prefixes are", () => {
    const bytes = zip({
      "docProps/core.xml": coreXml.replaceAll("dc:", "x:"),
      "docProps/app.xml": docxAppXml,
    });
    expect(readOoxml(bytes, "docx").title).toBe("Quarterly review & outlook");
  });

  it("throws on bytes that are not a zip archive", () => {
    expect(() => readOoxml(new TextEncoder().encode("not a zip"), "docx")).toThrow(/zip/);
  });
});
