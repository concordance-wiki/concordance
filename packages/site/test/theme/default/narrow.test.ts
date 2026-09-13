import { memoryFileSystem } from "@concordance-wiki/core";
import { beforeAll, describe, expect, it } from "vitest";

import { buildGallery } from "../../../src/gallery/build.js";
import {
  corporateDrawerHeader,
  corporateHeader,
  header,
  mentions,
} from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { RELATED_CONDENSED } from "../../../src/theme/default/mention-list.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Phone: the bar shows the mark, the site name and a menu button opening a full-screen drawer", () => {
  it("serves the drawer as a disclosure named for assistive technology, its summary the menu button, so that it opens without any script and over file://", () => {
    const html = renderSlot("Header", corporateHeader, defaultTheme);
    expect(html).toContain(
      '<nav class="site-nav" aria-label="Site"><details class="site-drawer" aria-label="Menu"><summary class="site-menu"><span class="visually-hidden">Menu</span></summary><div class="drawer">',
    );
    expect(html.indexOf('<details class="site-drawer"')).toBeLessThan(
      html.indexOf('<a class="site-title"'),
    );
    expect(html).not.toContain('class="site-drawer" aria-label="Menu" open');
    expectBalanced(html);
  });

  it("lists the spaces in the drawer with their initials badges and their page counts, each leading to its page, under the link to the spaces page", () => {
    const html = renderSlot("Header", corporateHeader, defaultTheme);
    expect(html).toContain(
      '<div class="drawer-spaces"><a class="drawer-spaces-title" href="../spaces/">Spaces</a><ul class="drawer-space-list"><li><a href="../glossary/"><span class="space-initials" aria-hidden="true">GL</span><span class="drawer-space-name">glossary</span><span class="count">48</span></a></li><li><a href="../specs/"><span class="space-initials" aria-hidden="true">SP</span><span class="drawer-space-name">specs</span><span class="count">57</span></a></li></ul></div>',
    );
    // A header without spaces lists none and keeps its links.
    const plain = renderSlot("Header", header, defaultTheme);
    expect(plain).not.toContain("drawer-spaces");
    expect(plain).toContain(
      '<div class="drawer"><ul class="site-links"><li><a href="../spaces/">Spaces</a></li>',
    );
  });

  it("unfolds the tree of the current space in the drawer, to the current page, as a plain block rather than a second landmark", () => {
    const html = renderSlot("Header", corporateHeader, defaultTheme);
    expect(html).toContain(
      '<div class="drawer-space"><details class="space-tree" open><summary class="space-head"><span class="space-initials" aria-hidden="true">SP</span><span class="space-name">specs</span></summary><ul class="space-nodes">',
    );
    expect(html).toContain(
      '<li class="space-page space-current"><span aria-current="page">Publication threshold</span></li>',
    );
    expect(html).not.toContain('<nav class="space"');
    expect(renderSlot("Header", header, defaultTheme)).not.toContain("drawer-space");
  });

  it("puts the index and the recent changes at the foot of the drawer and the mode switch after it, the search field folded behind its button", () => {
    const html = renderSlot("Header", corporateHeader, defaultTheme);
    expect(html).toContain(
      '<ul class="site-links"><li><a href="../index/">A–Z index</a></li><li><a href="../#home-recent">Recent</a></li></ul></div></details>',
    );
    expect(html).toContain(
      '<details class="site-search-fold"><summary class="site-search-button"><svg class="search-glyph"',
    );
    expect(html).toContain(
      '</svg><span class="site-search-label">Search</span></summary><concordance-island data-island="search"',
    );
    expect(html.indexOf('<details class="site-search-fold">')).toBeLessThan(
      html.indexOf('<concordance-island data-island="mode-switch"'),
    );
    const { search, ...withoutSearch } = header;
    expect(search).toBeDefined();
    expect(renderSlot("Header", withoutSearch, defaultTheme)).not.toContain("site-search-fold");
  });

  it("takes the labels of the site for the menu button and the search button", () => {
    const html = renderSlot(
      "Header",
      { ...corporateHeader, labels: { menu: "Menu principal", search: "Rechercher" } },
      defaultTheme,
    );
    expect(html).toContain(
      '<details class="site-drawer" aria-label="Menu principal"><summary class="site-menu"><span class="visually-hidden">Menu principal</span></summary>',
    );
    expect(html).toContain('</svg><span class="site-search-label">Rechercher</span></summary>');
  });

  it("serves the drawer open when asked to preview it", () => {
    const html = renderSlot("Header", corporateDrawerHeader, defaultTheme);
    expect(html).toContain('<details class="site-drawer" aria-label="Menu" open>');
    expectBalanced(html);
  });
});

describe("Tablet: the related pages show three titles and the count of the others", () => {
  it("folds the entries beyond the first three behind their count, in the served markup and in the island alike", () => {
    expect(RELATED_CONDENSED).toBe(3);
    const html = renderSlot("MentionsPanel", { mentions: mentions(25), initial: 25 }, defaultTheme);
    expect(count(html, '<li class="related-page')).toBe(9);
    expect(html).toContain(
      '</ol><details class="related-others"><summary>6 others</summary><ol class="related-list">',
    );
    expect(html).toContain(
      "&quot;other&quot;:&quot;{count} other&quot;,&quot;others&quot;:&quot;{count} others&quot;",
    );
    // One page beyond the three reads in the singular.
    const four = renderSlot("MentionsPanel", { mentions: mentions(12), initial: 12 }, defaultTheme);
    expect(four).toContain('<details class="related-others"><summary>1 other</summary>');
    const french = renderSlot(
      "MentionsPanel",
      { mentions: mentions(25), initial: 25, labels: { others: "{count} autres" } },
      defaultTheme,
    );
    expect(french).toContain("<summary>6 autres</summary>");
    expectBalanced(html);
  });

  it("lists three pages or fewer without any fold", () => {
    const html = renderSlot("MentionsPanel", { mentions: mentions(9), initial: 9 }, defaultTheme);
    expect(count(html, '<li class="related-page')).toBe(3);
    expect(html).not.toContain("related-others");
  });
});

describe("Gallery: the phone, drawer and tablet states of the corporate page", () => {
  const fileSystem = memoryFileSystem();
  let problems: string[] = [];

  beforeAll(async () => {
    const report = await buildGallery({ output: "/out", theme: defaultTheme, fileSystem });
    problems = report.problems;
  });

  it("renders the three states on the same page, the drawer one with the drawer open, and passes the accessibility checker", () => {
    const phone = fileSystem.readText("/out/entity-page-phone.html");
    const drawer = fileSystem.readText("/out/entity-page-drawer.html");
    const tablet = fileSystem.readText("/out/entity-page-tablet.html");
    expect(phone).toContain("<title>EntityPage, phone</title>");
    expect(drawer).toContain("<title>EntityPage, drawer</title>");
    expect(tablet).toContain("<title>EntityPage, tablet</title>");
    expect(phone).toContain('<details class="site-drawer" aria-label="Menu"><summary');
    expect(drawer).toContain('<details class="site-drawer" aria-label="Menu" open>');
    expect(tablet).not.toContain('aria-label="Menu" open');
    expect(problems).toEqual([]);
  });

  it("carries the markup the narrow layouts fold: the counts of the blocks, the short date, the related pages open, the others behind their count, the tree in the drawer", () => {
    const html = fileSystem.readText("/out/entity-page-tablet.html");
    expect(html).toContain(
      '<h2 id="entity-properties">Properties<span class="count panel-count">4</span></h2>',
    );
    expect(html).toContain(
      '<time class="entity-changed" datetime="2026-09-04"><span class="entity-changed-long">Changed 9 days ago</span><span class="entity-changed-short">Changed 9 days ago</span></time>',
    );
    expect(html).toContain('<details class="panel-fold" open><summary><h2 id="mentions-title">');
    expect(html).toContain('<details class="related-others"><summary>3 others</summary>');
    expect(html).toContain('<div class="drawer-space"><details class="space-tree" open>');
    expect(html).toContain(
      '<nav class="breadcrumbs" aria-label="You are here"><ol class="breadcrumbs-list"><li><a href="../../../#home-tree">specs</a></li><li><span>rules</span></li><li><span aria-current="page">Publication threshold</span></li></ol></nav>',
    );
  });
});
