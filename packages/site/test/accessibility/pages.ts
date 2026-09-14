import { nodeFileSystem } from "@concordance-wiki/core";
import {
  defaultTypesDirectory,
  loadDefaultProfile,
  readTypeModules,
} from "@concordance-wiki/profile";
import { expect } from "vitest";

import { galleryDocuments, type GalleryDocument } from "../../src/gallery/build.js";
import { galleryPages } from "../../src/gallery/pages.js";
import type { GalleryTypes } from "../../src/gallery/types.js";
import { defaultTheme } from "../../src/theme/resolve.js";

/** The islands of the default theme with fixed file names, so that the pages are the ones the gallery serves. */
export const islands = [
  { name: "category-list", file: "category-list-00000000.js", bytes: 0 },
  { name: "contract-viewer", file: "contract-viewer-00000000.js", bytes: 0 },
  { name: "document-viewer", file: "document-viewer-00000000.js", bytes: 0 },
  { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
  { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
  { name: "search", file: "search-00000000.js", bytes: 0 },
  { name: "tabs", file: "tabs-00000000.js", bytes: 0 },
  { name: "toc", file: "toc-00000000.js", bytes: 0 },
  { name: "trail", file: "trail-00000000.js", bytes: 0 },
];

/** The core types, as the gallery command shows them: one page per type that ships a template. */
export const coreTypes: GalleryTypes = {
  profile: loadDefaultProfile(),
  modules: readTypeModules(nodeFileSystem, defaultTypesDirectory()).modules,
};

/** Every page of the gallery through the default theme, the type pages and the index included: the fixtures the criteria are verified on. */
export const documents: readonly GalleryDocument[] = galleryDocuments(
  defaultTheme,
  islands,
  coreTypes,
);

/** The gallery states alone: one document per entry of the page list, in its order. */
export const states: readonly GalleryDocument[] = galleryPages.map((page) => {
  const found = documents.find((document) => document.path === page.file);
  expect(found, page.file).toBeDefined();
  // Asserted just above: every state of the list has its document.
  return found as GalleryDocument;
});

/** The main landmark of a page, tags included. */
export function mainOf(html: string): string {
  const start = html.indexOf('<main id="main">');
  const end = html.indexOf("</main>");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end + "</main>".length);
}

/** What a reader gets when no JavaScript runs: the same markup, every script removed, the islands left as served. */
export function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

/** The markup with every island cut out, content included: what stands outside any island. */
export function withoutIslands(html: string): string {
  return withoutScripts(html).replace(
    /<concordance-island\b[^>]*>[\s\S]*?<\/concordance-island>/g,
    "",
  );
}

/** The text of a markup, tags removed and entities of the renderer resolved, spaces collapsed. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replace(/\s+/g, " ")
    .trim();
}
