import { unzipSync } from "fflate";

import { compact, count, nonBlank, splitKeywords, type OfficeMetadata } from "./metadata.js";
import {
  childNamed,
  descendantsNamed,
  parseXml,
  textOf,
  textOfChild,
  type XmlElement,
} from "./xml.js";

export type OoxmlKind = "docx" | "pptx" | "xlsx";

type Parts = Record<string, Uint8Array>;

const slidePart = /^ppt\/slides\/slide(\d+)\.xml$/;
const titlePlaceholders = new Set(["title", "ctrTitle"]);

/** The children of the root element of a part, or none when the part is missing. */
function rootChildren(parts: Parts, path: string, root: string): XmlElement[] {
  const bytes = parts[path];
  if (bytes === undefined) return [];
  return childNamed(parseXml(bytes), root)?.children ?? [];
}

function isTitleShape(shape: XmlElement): boolean {
  return descendantsNamed(shape.children, "ph").some((placeholder) =>
    titlePlaceholders.has(placeholder.attributes["type"] ?? ""),
  );
}

/** The text runs of the title placeholder, joined and whitespace-normalised. */
function slideTitle(slide: Uint8Array): string {
  const shape = descendantsNamed(parseXml(slide), "sp").find(isTitleShape);
  if (shape === undefined) return "";
  return descendantsNamed(shape.children, "t").map(textOf).join("").replace(/\s+/g, " ").trim();
}

/**
 * Slides are taken in the numeric order of their part names. The presentation part lists the
 * slides in display order through relationships; producers number the parts in that order.
 */
function slideTitles(parts: Parts): string[] {
  return Object.entries(parts)
    .flatMap(([path, bytes]) => {
      const match = slidePart.exec(path);
      return match === null ? [] : [{ index: Number(match[1]), bytes }];
    })
    .sort((a, b) => a.index - b.index)
    .map((slide) => slideTitle(slide.bytes));
}

/** Reads the document properties of a Word, PowerPoint or Excel package; a missing part yields nothing. */
export function readOoxml(bytes: Uint8Array, kind: OoxmlKind): OfficeMetadata {
  const parts: Parts = unzipSync(bytes);
  const core = rootChildren(parts, "docProps/core.xml", "coreProperties");
  const app = rootChildren(parts, "docProps/app.xml", "Properties");
  return compact({
    title: nonBlank(textOfChild(core, "title")),
    author: nonBlank(textOfChild(core, "creator")),
    subject: nonBlank(textOfChild(core, "subject")),
    keywords: splitKeywords(textOfChild(core, "keywords")),
    created: nonBlank(textOfChild(core, "created")),
    modified: nonBlank(textOfChild(core, "modified")),
    lastModifiedBy: nonBlank(textOfChild(core, "lastModifiedBy")),
    pages: count(textOfChild(app, "Pages")),
    words: count(textOfChild(app, "Words")),
    slides: kind === "pptx" ? count(textOfChild(app, "Slides")) : undefined,
    slideTitles: kind === "pptx" ? slideTitles(parts) : undefined,
    application: nonBlank(textOfChild(app, "Application")),
  });
}
