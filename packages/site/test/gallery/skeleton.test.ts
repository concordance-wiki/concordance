import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { galleryDocuments } from "../../src/gallery/build.js";
import { galleryPages } from "../../src/gallery/pages.js";
import { skeletonOf } from "../../src/gallery/skeleton.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const snapshots = resolve(fileURLToPath(import.meta.url), "../__snapshots__");

const islands = [
  { name: "category-list", file: "category-list-00000000.js", bytes: 0 },
  { name: "contract-viewer", file: "contract-viewer-00000000.js", bytes: 0 },
  { name: "document-viewer", file: "document-viewer-00000000.js", bytes: 0 },
  { name: "gallery-width", file: "gallery-width-00000000.js", bytes: 0 },
  { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
  { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
  { name: "search", file: "search-00000000.js", bytes: 0 },
  { name: "tabs", file: "tabs-00000000.js", bytes: 0 },
  { name: "toc", file: "toc-00000000.js", bytes: 0 },
  { name: "panels", file: "panels-00000000.js", bytes: 0 },
  { name: "trail", file: "trail-00000000.js", bytes: 0 },
];

describe("skeletonOf keeps the structure of a page and drops its content", () => {
  it("lists the elements in document order, indented by depth, with their classes, role and ARIA attributes", () => {
    const html =
      '<!doctype html>\n<html lang="en" dir="ltr"><head><meta charset="utf-8"/><title>Home</title></head>' +
      '<body><a class="skip-link" href="#main">Skip</a><main id="main"><nav class="site-nav" aria-label="Site">' +
      '<a href="../">Home</a></nav><section aria-labelledby="x" role="region"><h2 id="x">Words</h2></section></main></body></html>';
    expect(skeletonOf(html)).toBe(
      [
        "<html>",
        "  <head>",
        "    <meta>",
        "    <title>",
        "  <body>",
        '    <a class="skip-link">',
        "    <main>",
        '      <nav class="site-nav" aria-label="Site">',
        "        <a>",
        '      <section aria-labelledby="x" role="region">',
        "        <h2>",
        "",
      ].join("\n"),
    );
  });

  it("keeps the island name and the served state of a disclosure or a hidden control, and skips comments and raw content", () => {
    const html =
      '<concordance-island data-island="toc" data-props="{&quot;a&quot;:1}"><details class="fold" open><summary>On this page</summary>' +
      '<button type="button" hidden aria-pressed="false">x</button></details></concordance-island>' +
      "<!-- a <b> in a comment --><script>if (a < b) { document.write('<p>') }</script><style>a > b {}</style><p>after</p>";
    expect(skeletonOf(html)).toBe(
      [
        '<concordance-island data-island="toc">',
        '  <details class="fold" open>',
        "    <summary>",
        '    <button hidden aria-pressed="false">',
        "<script>",
        "<style>",
        "<p>",
        "",
      ].join("\n"),
    );
  });

  it("leaves a self-closing tag and a void element childless, ignores a stray closing tag and closes up to a matching one", () => {
    expect(skeletonOf('<div><img src="a.png" alt=""/><br><hr/><span>x</span></div>')).toBe(
      "<div>\n  <img>\n  <br>\n  <hr>\n  <span>\n",
    );
    expect(skeletonOf("</p><ul><li><b>x</ul><i>y</i>")).toBe("<ul>\n  <li>\n    <b>\n<i>\n");
    expect(skeletonOf("<script>never closed")).toBe("<script>\n");
    expect(skeletonOf('<P CLASS="a" Hidden>x</P>')).toBe('<p class="a" hidden>\n');
  });

  it("gives the same skeleton from one call to the next", () => {
    const html = '<div class="a"><p>x</p></div><div class="b"></div>';
    expect(skeletonOf(html)).toBe(skeletonOf(html));
  });
});

describe("One structural snapshot per state pins the skeleton of its page; the snapshots are reviewed at each intentional change", () => {
  const documents = new Map(
    galleryDocuments(defaultTheme, islands).map((document) => [document.path, document.html]),
  );

  for (const page of [...galleryPages.map((page) => page.file), "index.html"]) {
    it(`pins the skeleton of ${page}`, async () => {
      const html = documents.get(page);
      expect(html).toBeDefined();
      await expect(skeletonOf(html ?? "")).toMatchFileSnapshot(
        resolve(snapshots, `${page.slice(0, -5)}.skeleton.html`),
        `the skeleton of ${page} changed: review the diff against its board and, when the change is intended, update the snapshot with vitest --update`,
      );
    });
  }
});
