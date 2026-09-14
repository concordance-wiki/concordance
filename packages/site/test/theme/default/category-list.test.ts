import { describe, expect, it } from "vitest";

import { corporateCategoryHeader, corporateCategoryList } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { CategoryListProps } from "../../../src/slots.js";
import { defaultCategoryListLabels } from "../../../src/theme/default/category-list.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { withoutHiddenControls } from "../../helpers/handles.js";
import { count, expectBalanced } from "../../helpers/html.js";

/** The view model of the gallery with some of its optional keys left out, then the overrides. */
function render(
  overrides: Partial<CategoryListProps> = {},
  omitted: { filter?: true; total?: true } = {},
): string {
  const { filter, total, ...rest } = corporateCategoryList;
  const props: CategoryListProps = {
    ...rest,
    ...(omitted.filter === true || filter === undefined ? {} : { filter }),
    ...(omitted.total === true || total === undefined ? {} : { total }),
    ...overrides,
  };
  return renderSlot("CategoryList", props, defaultTheme);
}

/** Asserts that the markers appear in the markup in the order given, each of them present. */
function expectInOrder(html: string, markers: string[]): void {
  const positions = markers.map((marker) => {
    const at = html.indexOf(marker);
    expect(at, marker).toBeGreaterThanOrEqual(0);
    return at;
  });
  expect(positions).toEqual(positions.slice().sort((a, b) => a - b));
}

describe("CategoryList", () => {
  it("lays out the tree of the space, the breadcrumb, the title and its lead, the selectors, the table, the count and the note, in that order", () => {
    const html = render();
    expectInOrder(html, [
      '<div class="category">',
      '<nav class="space" aria-label="Tree of the space">',
      '<nav class="breadcrumbs" aria-label="You are here">',
      '<header class="category-header"><h1>Screens</h1>',
      '<p class="category-lead">11 screens described. A screen is a page of the application, with what it shows and what it allows.</p>',
      '<div class="category-toolbar">',
      '<details class="category-select category-filter">',
      '<details class="category-select category-sort">',
      '<div class="category-card"><table class="category-table">',
      '<p class="category-foot">',
    ]);
    expectBalanced(html);
  });

  it("shows the space with its folders and their counts, this one marked as the current page, the others linked to their lists", () => {
    const html = render();
    expect(html).toContain(
      '<li class="space-folder"><a class="space-folder-name" href="../api/">api<span class="count">3</span></a></li>',
    );
    expect(html).toContain(
      '<li class="space-folder space-current"><span class="space-folder-name" aria-current="page">screens<span class="count">11</span></span></li>',
    );
    expect(html).toContain(
      '<ol class="breadcrumbs-list"><li><a href="../../spaces/">Spaces</a></li><li><a href="../">specs</a></li><li><span aria-current="page">Screens</span></li></ol>',
    );
  });

  it("draws the two selectors as disclosures reading what is selected with a mark, their choices linking to the pre-rendered variants, the current one ticked", () => {
    const html = render();
    expect(html).toContain(
      '<details class="category-select category-filter"><summary>Roles<span class="category-select-mark" aria-hidden="true">▾</span></summary><ul class="category-choices"><li><span aria-current="true">All</span></li><li><a href="-/roles-author/">Author</a></li><li><a href="-/roles-maintainer/">Maintainer</a></li><li><a href="-/roles-quality-owner/">Quality owner</a></li></ul></details>',
    );
    expect(html).toContain(
      '<details class="category-select category-sort"><summary><span class="visually-hidden">Sort: </span>A–Z<span class="category-select-mark" aria-hidden="true">▾</span></summary><ul class="category-choices"><li><span aria-current="true">A–Z</span></li><li><a href="-/links/">Links</a></li></ul></details>',
    );
    expect(withoutHiddenControls(html)).not.toContain("<button");
  });

  it("names the value kept on the summary of the attribute selector, the attribute before it for assistive technology", () => {
    const html = render({
      filter: {
        label: "Roles",
        choices: [
          { label: "All", href: "../../", active: false },
          { label: "Author", key: "author", active: true },
          { label: "Maintainer", key: "maintainer", href: "../roles-maintainer/", active: false },
        ],
      },
    });
    expect(html).toContain(
      '<summary><span class="visually-hidden">Roles: </span>Author<span class="category-select-mark" aria-hidden="true">▾</span></summary>',
    );
    expect(html).toContain('<li><a href="../../">All</a></li>');
  });

  it("leaves out the attribute selector when the attribute has no value to choose, and the choice without address stands as text", () => {
    const html = render({
      filter: { label: "Roles", choices: [{ label: "All", active: true }] },
      sorts: [
        { label: "A–Z", key: "title", active: true },
        { label: "Links", key: "links", active: false },
      ],
    });
    expect(html).not.toContain("category-filter");
    expect(html).toContain('<th scope="col" class="category-value">Roles</th>');
    expect(html).toContain("<li><span>Links</span></li>");
  });

  it("falls back on the title sort for the summary when no sort is marked", () => {
    const html = render({ sorts: [] });
    expect(html).toContain('<span class="visually-hidden">Sort: </span>A–Z<span');
    expect(html).toContain('<ul class="category-choices"></ul>');
  });

  it("tables every page with its title linked, the values of the attribute, its first line and its number of related pages, under uppercase headings", () => {
    const html = render();
    expect(html).toContain(
      '<thead><tr><th scope="col" class="category-title">Screen</th><th scope="col" class="category-value">Roles</th><th scope="col" class="category-summary">First line</th><th scope="col" class="category-links">Links</th></tr></thead>',
    );
    expect(html).toContain(
      '<tr><th scope="row" class="category-title"><a href="entity-page/">Entity page</a></th><td class="category-value"><span><a href="../roles/author/">Author</a></span><span>, <a href="../roles/maintainer/">Maintainer</a></span></td><td class="category-summary">Shows an entity with its attributes, its links grouped by relation, its neighbourhood and the passages that mention it.</td><td class="category-links">9</td></tr>',
    );
    expect(html).toContain(
      '<tr><th scope="row" class="category-title"><a href="service/document-viewer/">Document viewer</a></th><td class="category-value"></td><td class="category-summary">',
    );
    expect(count(html, '<th scope="row"')).toBe(11);
  });

  it("writes a value without address as text and a row without summary with an empty cell", () => {
    const html = render({
      rows: [
        {
          title: "Home",
          href: "home/",
          values: [{ text: "reader" }],
          keys: ["reader"],
          links: 4,
        },
      ],
    });
    expect(html).toContain(
      '<td class="category-value"><span>reader</span></td><td class="category-summary"></td><td class="category-links">4</td>',
    );
  });

  it("counts the rows shown of the whole and explains the links column under the table, the count in a live region", () => {
    const html = render();
    expect(html).toContain(
      '<p class="category-foot"><span class="category-shown" role="status">11 screens of 11 — pagination by twenty.</span> <span class="category-note">The Links column counts the related pages, which brings the most central screens of the journey to the top.</span></p>',
    );
    expect(html).not.toContain("category-pages");
    expect(render({ total: 64 })).toContain("11 screens of 64 — pagination by twenty.");
    expect(render({}, { total: true })).toContain("11 screens of 11 — pagination by twenty.");
  });

  it("links the pages of the list when it has several, the current one marked", () => {
    const html = render({
      page: 2,
      pages: [{ number: 1, href: "../../" }, { number: 2 }, { number: 3, href: "../page-3/" }],
    });
    expect(html).toContain(
      '<nav class="category-pages" aria-label="Pages of the list"><ol><li><a href="../../">1</a></li><li><span aria-current="page">2</span></li><li><a href="../page-3/">3</a></li></ol></nav>',
    );
  });

  it("uses the labels of the theme for every label the page does not receive", () => {
    const html = render({ labels: {} });
    expect(html).toContain('<span class="visually-hidden">Sort: </span>A–Z');
    expect(html).toContain('<th scope="col" class="category-summary">First line</th>');
    expect(html).toContain(
      '<span class="category-shown" role="status">11 of 11 — pagination by twenty.</span> <span class="category-note">The Links column counts the related pages, which brings the most central pages of the journey to the top.</span>',
    );
    expect(html).toContain('aria-label="Tree of the space"');
    expect(html).toContain('aria-label="You are here"');
    expect(defaultCategoryListLabels.pagination).toBe("Pages of the list");
    const partial = render({ labels: { firstLine: "Première ligne" } });
    expect(partial).toContain('<th scope="col" class="category-summary">Première ligne</th>');
    expect(partial).toContain('<th scope="col" class="category-links">Links</th>');
  });

  it("wraps the table in the island with every row when the choices apply in place, the selectors absent until it runs, the page links followed", () => {
    const html = render(
      {
        island: true,
        filter: {
          label: "Roles",
          choices: [
            { label: "All", active: true },
            { label: "Author", key: "author", active: false },
          ],
        },
        sorts: [
          { label: "A–Z", key: "title", active: true },
          { label: "Links", key: "links", active: false },
        ],
        page: 1,
        pages: [{ number: 1 }, { number: 2, href: "-/page-2/" }],
      },
      { total: true },
    );
    expect(html).toContain('<concordance-island data-island="category-list" data-props="');
    expect(html).not.toContain("category-toolbar");
    expect(html).toContain('<p class="category-lead">');
    expect(count(html, '<th scope="row"')).toBe(11);
    expect(html).toContain("11 screens of 11 — pagination by twenty.");
    expect(html).toContain(
      '<nav class="category-pages" aria-label="Pages of the list"><ol><li><span aria-current="page">1</span></li><li><a href="-/page-2/">2</a></li></ol></nav>',
    );
    expect(html).toContain("&quot;unit&quot;:&quot;Screen&quot;");
    expect(html).not.toContain("&quot;island&quot;");
    expectBalanced(html);
  });

  it("gives the island no filter for a folder mapping to no type", () => {
    const html = render({ island: true }, { filter: true });
    expect(html).not.toContain("&quot;filter&quot;");
    expect(html).toContain('<th scope="col" class="category-value"></th>');
  });

  it("wires the search field of its chrome to the category", () => {
    expect(corporateCategoryHeader.search).toEqual({
      action: "../search/",
      placeholder: "Search in screens",
      filters: { source: "specs", type: "screen" },
    });
    expect(corporateCategoryHeader.space?.nodes.find((node) => node.current)?.label).toBe(
      "screens",
    );
  });
});
