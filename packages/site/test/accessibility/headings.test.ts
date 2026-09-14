import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { wireArrows, wireEscape, wireShortcuts } from "../../src/islands/search.js";
import { wireTabs } from "../../src/islands/tabs.js";
import { SEARCH_SHORTCUT } from "../../src/theme/default/search-island.js";
import { SearchSuggestions } from "../../src/theme/default/search-suggestions.js";
import { count } from "../helpers/html.js";
import { documents, mainOf, textOf, withoutScripts } from "./pages.js";
import { declarationsOf, shipped } from "./stylesheet.js";

/** The pages whose bar carries the search field: every one but the chrome fixture served without it. */
const searched = documents.filter((document) =>
  document.html.slice(0, document.html.indexOf("<main")).includes('data-island="search"'),
);

const FOCUSABLE =
  /<(a [^>]*href=|button|input(?! type="hidden")|select|textarea|summary|[a-z]+ [^>]*tabindex=)/;

/** The headings of a page in document order, as `[level, text]`. */
function headings(html: string): [number, string][] {
  return [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map((match) => [
    Number(match[1]),
    textOf(match[2] ?? ""),
  ]);
}

describe("L9-08 headings, skip link, focus, tab order and keyboard shortcuts on every gallery state", () => {
  describe("one H1 per page, H2s from the markdown, the table of contents mirroring them", () => {
    it("writes exactly one h1 on every page, inside the main landmark, and never skips a heading level", () => {
      for (const { path, html } of documents) {
        expect(count(html, "<h1"), path).toBe(1);
        expect(count(mainOf(html), "<h1"), path).toBe(1);
        let previous = 0;
        for (const [level, text] of headings(html)) {
          expect(
            level,
            `${path}: h${String(level)} "${text}" after h${String(previous)}`,
          ).toBeLessThanOrEqual(previous + 1);
          previous = level;
        }
      }
    });

    it("lists in the table of contents exactly the h2 sections of the note, in their order, each entry pointing at its section", () => {
      let contents = 0;
      for (const { path, html } of documents) {
        const toc = /<ol class="toc-list">([\s\S]*?)<\/ol>/.exec(html)?.[1];
        if (toc === undefined) continue;
        contents += 1;
        const entries = [...toc.matchAll(/<a href="#([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((match) => [
          match[1],
          match[2],
        ]);
        const sections = [...html.matchAll(/<section id="([^"]+)"><h2>([^<]*)<\/h2>/g)].map(
          (match) => [match[1], match[2]],
        );
        expect(entries, path).toEqual(sections);
        expect(entries.length, path).toBeGreaterThan(0);
        expect(count(toc, 'aria-current="location"'), path).toBe(1);
      }
      expect(contents).toBeGreaterThan(5);
    });
  });

  describe("skip link and visible focus", () => {
    it("serves the skip link as the first focusable element of every page, pointing at the main landmark", () => {
      for (const { path, html } of documents) {
        const body = html.slice(html.indexOf("<body>"));
        expect(FOCUSABLE.exec(body)?.index, path).toBe(
          body.indexOf('<a class="skip-link" href="#main">'),
        );
        expect(html, path).toContain('<main id="main">');
      }
      expect(declarationsOf(".skip-link")).toMatchObject({
        position: "absolute",
        transform: "translateY(-100%)",
      });
      expect(declarationsOf(".skip-link:focus")).toEqual({ transform: "none", "z-index": "1" });
    });

    it("pins the focus-visible rule: one ring for links, buttons, fields, selects, text areas, summaries and anything with a tabindex, 3 px in the accent, offset 2 px", () => {
      expect(
        declarationsOf(
          "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible",
        ),
      ).toEqual({ outline: "3px solid var(--color-accent)", "outline-offset": "2px" });
      const focus = shipped.filter((rule) => rule.selector.includes(":focus"));
      expect(focus.map((rule) => rule.selector)).toEqual([
        "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible",
        ".skip-link:focus",
        ".suggestion > a:hover, .suggestion > a:focus-visible",
      ]);
      for (const rule of shipped) {
        expect(rule.declarations["outline"] ?? "", rule.selector).not.toMatch(
          /^(none|0|transparent)$/,
        );
        for (const property of ["outline-width", "outline-style", "outline-color"]) {
          expect(rule.declarations[property], rule.selector).toBeUndefined();
        }
      }
    });
  });

  describe("tab order: the interactive elements in document order", () => {
    it("sets no tabindex at all in the served markup and no inline handler, on every page", () => {
      for (const { path, html } of documents) {
        expect(html, path).not.toMatch(/\stabindex=/);
        expect(html, path).not.toMatch(/\son[a-z]+=/);
      }
    });

    it("reads skip link, header, main, footer on every page, the drawer before the name in the bar as on the phone, the field after it", () => {
      for (const { path, html } of documents) {
        const markers = [
          '<a class="skip-link" href="#main">',
          '<header class="site-header">',
          '<details class="site-drawer"',
          '<a class="site-title"',
          '<details class="site-search-fold">',
          '<concordance-island data-island="trail"',
          '<concordance-island data-island="mode-switch"',
          '<main id="main">',
          "</main>",
          '<footer class="site-footer">',
        ];
        // A chrome fixture without a search field has no fold: the other markers stand on every page.
        const positions = markers
          .map((marker) => html.indexOf(marker))
          .filter((position, index) => position > 0 || !markers[index]?.includes("search-fold"));
        expect(positions.length, path).toBeGreaterThanOrEqual(markers.length - 1);
        expect(
          positions.every((position) => position > 0),
          path,
        ).toBe(true);
        expect(
          [...positions].sort((a, b) => a - b),
          path,
        ).toEqual(positions);
      }
    });

    it("moves elements by order in the stylesheet only where the list says, markers and the bar of the wider widths, so that the focus order stays the phone's reading order", () => {
      const ordered = shipped
        .filter((rule) => rule.declarations["order"] !== undefined)
        .map((rule) => [rule.selector, rule.declarations["order"], rule.under ?? ""]);
      expect(ordered).toEqual([
        // Markers drawn after the text of their summary or line: not focusable.
        [".panel-fold > summary::before", "1", ""],
        [".related-types > summary::before", "1", ""],
        [".neighbourhood-fold > summary::before", "2", ""],
        [".index-filters-button::before", "1", ""],
        // The open drawer of the phone and the tablet: the field first, the links, the mode switch last.
        [".drawer", "2", "@media (width < 68.75rem)"],
        [".site-drawer[open] ~ .site-search-fold", "1", "@media (width < 68.75rem)"],
        [
          '.site-drawer[open] ~ concordance-island[data-island="mode-switch"]',
          "3",
          "@media (width < 68.75rem)",
        ],
        // The phone lays the table of contents first among the folded blocks.
        [".entity-toc", "-1", "@media (width < 43.75rem)"],
        [
          ".neighbourhood-fold:not([open]) > summary > .neighbourhood-number",
          "1",
          "@media (width < 43.75rem)",
        ],
        // The desktop bar: the links of the drawer after the field, the trail and the switch at the end.
        [".site-drawer", "1", "@media (min-width: 68.75rem)"],
        [
          '.site-nav > concordance-island[data-island="trail"], .site-nav > concordance-island[data-island="mode-switch"]',
          "2",
          "@media (min-width: 68.75rem)",
        ],
        [".neighbourhood-fold[open] > summary::before", "0", ""],
        [".facet > summary::before", "1", ""],
      ]);
    });
  });

  describe("every keyboard shortcut has a clickable equivalent", () => {
    it("reaches the search field by / and by the field itself, or the search button of the narrow bar; the hint is drawn for sighted readers alone", () => {
      expect(SEARCH_SHORTCUT).toBe("/");
      expect(typeof wireShortcuts).toBe("function");
      expect(searched.length).toBeGreaterThan(documents.length - 3);
      for (const { path, html } of searched) {
        expect(html, path).toContain('<input id="site-search" type="search" name="q"');
        expect(html, path).toContain('<summary class="site-search-button">');
        expect(html, path).toContain('<kbd class="search-shortcut" aria-hidden="true">/</kbd>');
      }
    });

    it("leaves the field and its live results by Escape and by the clear button served beside the field, named for assistive technology", () => {
      expect(typeof wireEscape).toBe("function");
      for (const { path, html } of searched) {
        expect(html, path).toContain(
          '<button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Clear the search</span></button>',
        );
      }
    });

    it("walks the live results by the arrow keys and by their rows, every row a link, the help naming the keys and the link to the whole list beside them", () => {
      expect(typeof wireArrows).toBe("function");
      const html = renderToString(
        h(SearchSuggestions, {
          query: "threshold",
          suggestions: [
            {
              title: "Publication threshold",
              href: "specs/rules/publication-threshold/",
              typeLabel: "Business rule",
              summary: "Three occurrences in two files before a word gets a page.",
              cited: 12,
              space: "specs",
            },
          ],
          total: 3,
          resultsHref: "search/?q=threshold",
          locale: "en",
        }),
      );
      expect(html).toContain(
        '<li class="suggestion"><a href="specs/rules/publication-threshold/">',
      );
      expect(html).toContain(
        '<p class="suggestions-help"><kbd>↑ ↓</kbd> browse <kbd>Enter</kbd> open',
      );
      expect(html).toContain(
        '<a class="suggestions-all" href="search/?q=threshold">See the 3 results</a>',
      );
    });

    it("moves along a row of tabs by the arrow keys and by the tabs themselves, each a link to its panel that works before any script", () => {
      expect(typeof wireTabs).toBe("function");
      let rows = 0;
      for (const { path, html } of documents) {
        for (const [row] of html.matchAll(
          /<div class="tabs-list" role="tablist"[\s\S]*?<\/div>/g,
        )) {
          rows += 1;
          const tabs = [
            ...row.matchAll(
              /<a class="tab" role="tab" id="([^"]+)" href="#([^"]+)" aria-controls="([^"]+)"/g,
            ),
          ];
          expect(tabs.length, path).toBeGreaterThan(0);
          for (const [, , href, controls] of tabs) {
            expect(href, path).toBe(controls);
            expect(html, path).toContain(`id="${controls ?? ""}"`);
          }
        }
        const main = mainOf(withoutScripts(html));
        expect(count(main, 'role="tab"'), path).toBe(count(main, 'role="tab" id='));
      }
      expect(rows).toBeGreaterThanOrEqual(2);
    });

    it("opens every disclosure of the page with the pointer or the keyboard alike: the drawer, the search fold, the tree, the blocks of the panel and the folds are native details elements", () => {
      for (const { path, html } of searched) {
        expect(html, path).toContain(
          '<details class="site-search-fold"><summary class="site-search-button">',
        );
      }
      for (const { path, html } of documents) {
        expect(html, path).toMatch(
          /<details class="site-drawer" aria-label="Menu"( open)?><summary class="site-menu">/,
        );
        for (const [details] of html.matchAll(/<details[^>]*>[\s\S]{0,200}/g)) {
          expect(details, path).toMatch(/^<details[^>]*><summary/);
        }
      }
    });
  });
});
