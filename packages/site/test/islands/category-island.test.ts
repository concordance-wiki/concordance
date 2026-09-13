// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/specs/screens/" }
import { h, render } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, describe, expect, it } from "vitest";

import type { CategoryRow } from "../../src/slots.js";
import {
  CATEGORY_ISLAND,
  CATEGORY_PAGE_SIZE,
  CategoryIsland,
  filterRows,
  orderRows,
  pageCount,
  pageRows,
  sortChoices,
  type CategoryIslandProps,
} from "../../src/theme/default/category-island.js";
import { defaultCategoryListLabels } from "../../src/theme/default/category-list.js";

function row(title: string, keys: string[], links: number): CategoryRow {
  return {
    title,
    href: `${title.toLowerCase().replaceAll(" ", "-")}/`,
    values: keys.map((key) => ({ text: key })),
    keys,
    summary: `${title} summarised.`,
    links,
  };
}

const rows: CategoryRow[] = [
  row("Alphabetical index", ["author"], 3),
  row("Entity page", ["author", "maintainer"], 9),
  row("Home page", ["author"], 4),
  row("Keyword page", ["maintainer"], 12),
  row("Mentions panel", [], 7),
];

function props(overrides: Partial<CategoryIslandProps> = {}, filtered = true): CategoryIslandProps {
  const all: CategoryIslandProps = {
    unit: "Screen",
    filter: {
      label: "Roles",
      choices: [
        { label: "All", active: true },
        { label: "Author", key: "author", active: false },
        { label: "Maintainer", key: "maintainer", active: false },
      ],
    },
    sort: "title",
    rows,
    page: 1,
    pages: [{ number: 1 }],
    labels: defaultCategoryListLabels,
    ...overrides,
  };
  if (!filtered) delete all.filter;
  return all;
}

/** Lets Preact flush the state changes it batched. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Mounts the island as the browser would, once the entry runs, and waits for it to declare itself hydrated. */
async function mount(input: CategoryIslandProps): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  render(h(CategoryIsland, input), host);
  await settle();
  return host;
}

function q(host: Element, selector: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`${selector}: not found`);
  return found;
}

/** The titles of the rows shown. */
const titles = (host: Element): string[] =>
  [...host.querySelectorAll(".category-table tbody .category-title")].map(
    (cell) => cell.textContent,
  );

const button = (host: Element, selector: string, text: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll<HTMLButtonElement>(`${selector} button`)].find(
    (candidate) => candidate.textContent === text,
  );
  if (found === undefined) throw new Error(`button "${text}" in ${selector}: not found`);
  return found;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("The helpers of the list", () => {
  it("order the rows by title as received or by number of related pages, most first, two equal counts keeping their order", () => {
    expect(orderRows(rows, "title")).toEqual(rows);
    expect(orderRows(rows, "title")).not.toBe(rows);
    expect(orderRows(rows, "links").map((entry) => entry.title)).toEqual([
      "Keyword page",
      "Entity page",
      "Mentions panel",
      "Home page",
      "Alphabetical index",
    ]);
    const twins = [row("B", [], 2), row("A", [], 2)];
    expect(orderRows(twins, "links").map((entry) => entry.title)).toEqual(["B", "A"]);
  });

  it("keep the rows carrying a key, every row when the filter is lifted", () => {
    expect(filterRows(rows, undefined)).toEqual(rows);
    expect(filterRows(rows, "maintainer").map((entry) => entry.title)).toEqual([
      "Entity page",
      "Keyword page",
    ]);
    expect(filterRows(rows, "nobody")).toEqual([]);
  });

  it("page by twenty, one page at least, the first page for a number out of range", () => {
    expect(CATEGORY_PAGE_SIZE).toBe(20);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
    const many = Array.from({ length: 45 }, (_, index) => row(`Row ${String(index)}`, [], 0));
    expect(pageRows(many, 1).map((entry) => entry.title)).toEqual(
      many.slice(0, 20).map((entry) => entry.title),
    );
    expect(pageRows(many, 3)).toHaveLength(5);
    expect(pageRows(many, 0)).toEqual(pageRows(many, 1));
    expect(pageRows(many, 4)).toEqual(pageRows(many, 1));
  });

  it("word the two sort choices, the current one active, with their addresses when given", () => {
    expect(sortChoices(defaultCategoryListLabels, "links")).toEqual([
      { label: "A–Z", key: "title", active: false },
      { label: "Links", key: "links", active: true },
    ]);
    expect(sortChoices(defaultCategoryListLabels, "title", { links: "-/links/" })).toEqual([
      { label: "A–Z", key: "title", active: true },
      { label: "Links", key: "links", href: "-/links/", active: false },
    ]);
  });
});

describe("The category island applies the sort and the filter in place once it runs", () => {
  it("renders the served page of the rows without any selector until it mounts, then adds the selectors as buttons", async () => {
    expect(CATEGORY_ISLAND).toBe("category-list");
    const served = renderToString(h(CategoryIsland, props({ page: 1 })));
    expect(served).not.toContain("category-toolbar");
    expect(served).not.toContain("<button");
    expect(served).toContain('<th scope="row" class="category-title"><a href="entity-page/">');
    const host = await mount(props());
    const toolbar = q(host, ".category-toolbar");
    expect(q(toolbar, ".category-filter > summary").textContent).toBe("Roles▾");
    expect(q(toolbar, ".category-sort > summary").textContent).toBe("Sort: A–Z▾");
    expect(
      [...toolbar.querySelectorAll(".category-filter button")].map((entry) => [
        entry.textContent,
        entry.getAttribute("aria-pressed"),
      ]),
    ).toEqual([
      ["All", "true"],
      ["Author", "false"],
      ["Maintainer", "false"],
    ]);
    expect(host.querySelector(".category-toolbar a")).toBeNull();
    expect(titles(host)).toEqual([
      "Alphabetical index",
      "Entity page",
      "Home page",
      "Keyword page",
      "Mentions panel",
    ]);
    expect(q(host, ".category-shown").textContent).toBe("5 of 5 — pagination by twenty.");
  });

  it("re-orders the rows by number of related pages and back by title, the summary of the sort selector following, the selector closing on the choice", async () => {
    const host = await mount(props());
    const selector = q(host, "details.category-sort");
    if (!(selector instanceof HTMLDetailsElement)) throw new Error("details expected");
    selector.open = true;
    selector.dispatchEvent(new Event("toggle"));
    await settle();
    expect(selector.open).toBe(true);
    button(host, ".category-sort", "Links").click();
    await settle();
    expect(selector.open).toBe(false);
    expect(titles(host)).toEqual([
      "Keyword page",
      "Entity page",
      "Mentions panel",
      "Home page",
      "Alphabetical index",
    ]);
    expect(q(host, ".category-sort > summary").textContent).toBe("Sort: Links▾");
    expect(button(host, ".category-sort", "Links").getAttribute("aria-pressed")).toBe("true");
    button(host, ".category-sort", "A–Z").click();
    await settle();
    expect(titles(host)[0]).toBe("Alphabetical index");
  });

  it("keeps the rows of the value chosen, names it on the summary, and lifts the filter with the first entry", async () => {
    const host = await mount(props());
    button(host, ".category-filter", "Maintainer").click();
    await settle();
    expect(titles(host)).toEqual(["Entity page", "Keyword page"]);
    expect(q(host, ".category-filter > summary").textContent).toBe("Roles: Maintainer▾");
    expect(q(host, ".category-shown").textContent).toBe("2 of 2 — pagination by twenty.");
    button(host, ".category-filter", "All").click();
    await settle();
    expect(titles(host)).toHaveLength(5);
    expect(q(host, ".category-filter > summary").textContent).toBe("Roles▾");
  });

  it("pages the rows kept by twenty with buttons, a choice returning to the first page", async () => {
    const many = Array.from({ length: CATEGORY_PAGE_SIZE + 3 }, (_, index) =>
      row(`Row ${String(index).padStart(2, "0")}`, index % 2 === 0 ? ["even"] : ["odd"], index),
    );
    const host = await mount(
      props({
        rows: many,
        page: 2,
        pages: [{ number: 1, href: "../../" }, { number: 2 }],
        filter: {
          label: "Parity",
          choices: [
            { label: "All", active: true },
            { label: "Even", key: "even", active: false },
          ],
        },
      }),
    );
    expect(titles(host)).toEqual(["Row 20", "Row 21", "Row 22"]);
    expect(q(host, ".category-shown").textContent).toBe("3 of 23 — pagination by twenty.");
    const pages = q(host, ".category-pages");
    expect(pages.getAttribute("aria-label")).toBe("Pages of the list");
    expect(pages.querySelector("a")).toBeNull();
    expect(q(pages, '[aria-current="page"]').textContent).toBe("2");
    button(host, ".category-pages", "1").click();
    await settle();
    expect(titles(host)).toHaveLength(20);
    expect(q(host, ".category-pages [aria-current='page']").textContent).toBe("1");
    button(host, ".category-pages", "2").click();
    await settle();
    expect(titles(host)[0]).toBe("Row 20");
    button(host, ".category-filter", "Even").click();
    await settle();
    expect(titles(host)).toHaveLength(12);
    expect(host.querySelector(".category-pages")).toBeNull();
    button(host, ".category-sort", "Links").click();
    await settle();
    expect(titles(host)[0]).toBe("Row 22");
  });

  it("shows the first page when the served page number is out of range, and no attribute selector without a filter", async () => {
    const host = await mount(props({ page: 9 }, false));
    expect(titles(host)).toHaveLength(5);
    expect(host.querySelector(".category-filter")).toBeNull();
    expect(q(host, ".category-toolbar .category-sort")).toBeDefined();
    expect(q(host, 'th[scope="col"].category-value').textContent).toBe("");
  });
});
