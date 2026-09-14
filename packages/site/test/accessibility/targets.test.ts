import { describe, expect, it } from "vitest";

import { count } from "../helpers/html.js";
import { documents } from "./pages.js";
import { declarationsOf, pixels, rulesFor, shipped, type Rule } from "./stylesheet.js";

/** The smallest target the theme allows, and the floor of a line of text: 13 px at the line height of the page. */
const MINIMUM = 40;
const LINE = 0.8125 * 16 * 1.5;

/** The generic rule of the base layer that gives every control 40 px before any component rule. */
const CONTROLS = 'button, input:not([type="checkbox"]):not([type="radio"]), select, summary';

/**
 * One interactive selector of the shipped stylesheets: the element it renders as when its own
 * rules leave the height to the base layer, and the lines of text it always holds when its
 * height comes from its padding and its text rather than from a declared size.
 */
interface Target {
  selector: string;
  as?: "button" | "input" | "summary";
  lines?: number;
}

/** Every interactive selector of the default theme, by region of the page; a selector absent from the stylesheets fails the test. */
const TARGETS: readonly Target[] = [
  // The skip link and the bar.
  { selector: ".skip-link" },
  { selector: ".site-menu" },
  { selector: ".site-title" },
  { selector: ".site-search-button" },
  { selector: ".site-search input", as: "input" },
  { selector: ".search-clear", as: "button" },
  { selector: ".mode-switch" },
  { selector: ".pin > a" },
  { selector: ".pin-remove" },
  { selector: ".pins-more-button" },
  { selector: ".pins-filter", as: "input" },
  { selector: ".pins-row > a" },
  { selector: ".pins-remove-all" },
  { selector: ".pin-button" },
  // The drawer and the links of the bar.
  { selector: ".drawer-spaces-title" },
  { selector: ".drawer-space-list a" },
  { selector: ".drawer .site-links a" },
  { selector: ".site-links a" },
  // The tree of the space.
  { selector: ".space-head" },
  { selector: ".space-folder-name" },
  { selector: ".space-page > a" },
  { selector: ".space-page > span" },
  { selector: ".breadcrumbs-list a" },
  // The live results of the search field.
  { selector: ".suggestion > a" },
  { selector: ".suggestions-all" },
  // The panel: its blocks, the table of contents, the related pages and their filter.
  { selector: ".panel-fold > summary" },
  { selector: ".toc-list a" },
  { selector: ".mentions-controls input", as: "input" },
  { selector: ".related-types > summary", as: "summary" },
  { selector: ".related-type-list label" },
  { selector: ".related-clear" },
  { selector: ".related-others > summary" },
  { selector: ".related-beyond > summary", as: "summary" },
  { selector: ".mentions-more button" },
  { selector: ".mentions-more a" },
  { selector: ".neighbourhood-fold > summary" },
  { selector: ".neighbourhood-type > label" },
  // The home page.
  { selector: ".home-search-field" },
  { selector: ".home-search-field input", as: "input" },
  { selector: ".chip" },
  { selector: ".home-space-row" },
  { selector: ".home-more-spaces > summary", as: "summary" },
  { selector: ".home-change > a", lines: 2 },
  // The index and its filters.
  { selector: ".index-filters-button", as: "summary" },
  { selector: ".index-filter-list a" },
  { selector: ".letter" },
  // The keyword page.
  { selector: ".keyword-notice .create-note" },
  { selector: ".passage-title" },
  { selector: ".passage-more > summary" },
  { selector: ".passage-files-more > summary", as: "summary" },
  { selector: ".similar-lead" },
  // The results page and its facets.
  { selector: ".facets-head" },
  { selector: ".facet > summary" },
  { selector: ".facet-value label" },
  { selector: ".remove-filter" },
  { selector: ".clear-filters a" },
  { selector: ".results-more" },
  // The tabs of the meeting and document pages.
  { selector: ".tab" },
  // The spaces pages.
  { selector: ".spaces-name a" },
  { selector: ".space-category > a" },
  { selector: ".space-change > a", lines: 2 },
  { selector: ".space-word-list .chip" },
  // The category list and its selectors.
  { selector: ".category-select > summary" },
  { selector: ".category-choices a" },
  { selector: ".category-choices button" },
  { selector: ".category-pages a" },
  { selector: ".category-pages button" },
  // The documents: the viewer, the rail of pages, the views and the contract.
  { selector: ".document-open", as: "button" },
  { selector: ".viewer-toolbar button", as: "button" },
  { selector: ".viewer-toolbar .viewer-zoom-out" },
  { selector: ".viewer-toolbar .viewer-zoom-in" },
  { selector: ".viewer-find input" },
  { selector: ".document-rail a" },
  { selector: ".document-page .document-rail a" },
  { selector: ".document-views .document-download" },
  { selector: ".document-text summary", as: "summary" },
  { selector: ".contract-operation > button", as: "button" },
  { selector: ".contract-schema-list button", as: "button" },
  { selector: ".todo-fold > summary", as: "summary" },
];

/** The last value a property takes across rules, in cascade order. */
function last(rules: readonly Rule[], property: string): string | undefined {
  return rules
    .map((rule) => rule.declarations[property])
    .filter((value): value is string => value !== undefined)
    .at(-1);
}

/** The vertical padding of a rule set, from `padding-block` or the `padding` shorthand, in pixels. */
function paddingBlock(rules: readonly Rule[]): number {
  const block = last(rules, "padding-block");
  if (block !== undefined) {
    const [start, end] = block.split(/\s+/);
    return (pixels(start) ?? 0) + (pixels(end ?? start) ?? 0);
  }
  const shorthand = last(rules, "padding");
  if (shorthand === undefined) return 0;
  const parts = shorthand.split(/\s+/);
  const start = parts[0];
  const end = parts.length >= 3 ? parts[2] : start;
  return (pixels(start) ?? 0) + (pixels(end) ?? 0);
}

/**
 * The height a target is guaranteed, read from the stylesheet: its declared minimum or fixed
 * block size, else the one the base layer gives the control it renders as, else its vertical
 * padding plus the lines of text it holds at the smallest line of the theme.
 */
function guaranteedHeight(target: Target, rules: readonly Rule[]): number {
  const declared = pixels(last(rules, "min-block-size")) ?? pixels(last(rules, "block-size"));
  if (declared !== undefined) return declared;
  if (target.as !== undefined) {
    const base = pixels(declarationsOf(CONTROLS)["min-block-size"]);
    expect(base).toBe(MINIMUM);
    return base ?? 0;
  }
  return paddingBlock(rules) + (target.lines ?? 0) * LINE;
}

describe("L9-08 targets of 40 px at least on every interactive element, read from the stylesheet rules", () => {
  it("names every interactive selector of the shipped stylesheets, none twice", () => {
    expect(new Set(TARGETS.map((target) => target.selector)).size).toBe(TARGETS.length);
    for (const { selector } of TARGETS) {
      expect(rulesFor(selector).length, selector).toBeGreaterThan(0);
    }
  });

  for (const target of TARGETS) {
    it(`gives ${target.selector} a target of ${String(MINIMUM)} px or more at every width`, () => {
      const rules = rulesFor(target.selector);
      const base = rules.filter((rule) => rule.under === undefined);
      const height = guaranteedHeight(target, base);
      expect(height, `${target.selector}: ${String(height)} px`).toBeGreaterThanOrEqual(MINIMUM);
      // A rule that clips the element to a pixel keeps it for assistive technology alone: it is no target there.
      for (const rule of rules.filter(
        (rule) => rule.under !== undefined && rule.declarations["clip-path"] !== "inset(50%)",
      )) {
        const resized =
          pixels(rule.declarations["min-block-size"]) ?? pixels(rule.declarations["block-size"]);
        if (resized !== undefined) {
          expect(resized, `${target.selector} under ${rule.under ?? ""}`).toBeGreaterThanOrEqual(
            MINIMUM,
          );
        }
      }
    });
  }

  it("gives every button, field, select and summary 40 px in the base layer before any component rule, checkboxes and radios excepted", () => {
    expect(declarationsOf(CONTROLS)).toEqual({ "min-block-size": "2.5rem" });
  });

  it("covers the row of every checkbox with its label: the box is 16 px, the label beside it takes the row and the height", () => {
    expect(declarationsOf(".facet-value input")).toMatchObject({
      "inline-size": "1rem",
      "block-size": "1rem",
    });
    for (const selector of [
      ".facet-value label",
      ".neighbourhood-type > label",
      ".related-type-list label",
    ]) {
      const declarations = declarationsOf(selector);
      expect(declarations, selector).toMatchObject({
        display: "flex",
        "min-block-size": "2.5rem",
        cursor: "pointer",
      });
    }
    expect(declarationsOf(".facet-value label")["flex"]).toBe("1");
    expect(declarationsOf(".neighbourhood-type > label")["flex"]).toBe("1");
  });

  it("wraps every served checkbox in a labelled row, the box before its label, on every page that has one", () => {
    let boxes = 0;
    for (const { path, html } of documents) {
      for (const [box] of html.matchAll(/<input type="(checkbox|radio)"[^>]*>/g)) {
        boxes += 1;
        const id = /id="([^"]+)"/.exec(box)?.[1] ?? "";
        expect(id, `${path}: ${box}`).not.toBe("");
        expect(count(html, `<label for="${id}">`), `${path}: ${id}`).toBe(1);
      }
    }
    expect(boxes).toBeGreaterThan(20);
  });

  it("keeps the targets of the phone at 48 px: the menu button, the entries of the drawer, the head of the tree", () => {
    expect(declarationsOf(".site-menu")).toMatchObject({
      "inline-size": "3rem",
      "min-block-size": "3rem",
    });
    expect(
      declarationsOf(".drawer-spaces-title, .drawer-space-list a, .drawer .site-links a"),
    ).toMatchObject({
      "min-block-size": "3rem",
    });
    expect(declarationsOf(".space-head")).toMatchObject({ "min-block-size": "3.5rem" });
    const phone = shipped.filter((rule) => rule.under === "@media (width < 43.75rem)");
    expect(phone.some((rule) => rule.declarations["min-block-size"] === "3rem")).toBe(true);
  });
});
