import { describe, expect, it } from "vitest";

import { baseStylesheet } from "../../src/css/stylesheet.js";
import { markLabels } from "../../src/markdown/marks.js";
import { renderMarkdown } from "../../src/markdown/render.js";
import { count } from "../helpers/html.js";
import { documents, mainOf, states } from "./pages.js";
import { declarationsOf, selectorsOf, shipped } from "./stylesheet.js";

const of = (path: string): string => {
  const found = documents.find((document) => document.path === path);
  expect(found, path).toBeDefined();
  return found?.html ?? "";
};

/** The corporate states of the entity page, whose text is rendered with the marks of the build. */
const corporate = states.filter((state) =>
  /^entity-page-(corporate|phone|drawer|tablet|map)\.html$/.test(state.path),
);

describe("L9-08 colour never carries information alone", () => {
  describe("a word without a note: a dashed underline, and the same information in the title and in hidden text", () => {
    it("draws the mark of a noteless word dashed in the label grey and the mark of a word with a note dotted, the ink for both", () => {
      expect(declarationsOf(".markdown .recognised-keyword")).toEqual({
        "text-decoration-style": "dashed",
        "text-decoration-color": "var(--color-label)",
      });
      expect(declarationsOf(".markdown .recognised, .markdown .recognised-keyword")).toEqual({
        color: "var(--color-ink)",
        "text-decoration-style": "dotted",
        "text-decoration-color": "var(--color-accent)",
        "text-underline-offset": "0.2em",
      });
    });

    it("writes the title of every mark on its anchor and again as hidden text, in the words of the catalogue, when a note is rendered", () => {
      const labels = markLabels("en");
      const html =
        renderMarkdown("# Note\n\nThe build summary is posted, then the entity is typed.\n", {
          recognised: [
            {
              line: 3,
              text: "build summary",
              href: "../build-summary/",
              keyword: true,
              title: labels.noNote(7),
            },
            { line: 3, text: "entity", href: "../entity/", title: labels.note("Entity") },
          ],
        }).sections[0]?.html ?? "";
      expect(html).toBe(
        '<p>The <a href="../build-summary/" class="recognised-keyword" title="7 passages, no note">build summary<span class="visually-hidden"> (7 passages, no note)</span></a> is posted, then the <a href="../entity/" class="recognised" title="note: Entity">entity<span class="visually-hidden"> (note: Entity)</span></a> is typed.</p>',
      );
      expect(markLabels("fr").noNote(1)).toBe("1 passage, sans fiche");
    });

    it("carries the title and the hidden text on every mark of the corporate states, whose text the build rendered", () => {
      expect(corporate.map((state) => state.path)).toHaveLength(5);
      let marks = 0;
      for (const { path, html } of corporate) {
        const anchors = [...html.matchAll(/<a [^>]*class="recognised(?:-keyword)?"[^>]*>/g)];
        expect(anchors.length, path).toBeGreaterThan(0);
        for (const [tag] of anchors) {
          marks += 1;
          expect(tag, path).toMatch(/ title="(note: [^"]+|\d+ passages?, no note)"/);
        }
        expect(count(html, '<span class="visually-hidden"> (note: '), path).toBe(
          count(html, 'class="recognised" title='),
        );
        expect(count(html, '<span class="visually-hidden"> ('), path).toBe(anchors.length);
        expect(html, path).toContain(
          '<span class="legend-keyword">recognised word, no note</span>',
        );
      }
      expect(marks).toBeGreaterThan(12);
    });

    it("says the same of a noteless word wherever it stands: the index, the results, the space chips and the map legend each carry a word", () => {
      const index = of("index-corporate.html");
      expect(index).toContain('<tr class="index-entry index-entry-noteless">');
      expect(index).toContain('<span class="index-no-definition">no definition</span>');
      const results = of("search-results-corporate.html");
      expect(results).toContain(
        '<li class="result result-keyword"><p class="result-head"><span class="badge">Without a definition</span>',
      );
      const space = of("space-corporate.html");
      expect(space).toContain(
        '<a class="chip chip-keyword" href="../keywords/build-summary/" title="no note">build summary<span class="visually-hidden"> (no note)</span>',
      );
      const map = of("entity-page-map.html");
      expect(map).toMatch(/<span class="map-legend-keyword">[^<]+<\/span>/);
      expect(declarationsOf(".chip-keyword")).toEqual({
        "border-style": "dashed",
        color: "var(--color-muted)",
      });
    });
  });

  describe("the current page: a rule, the bold weight and aria-current", () => {
    it("marks the current page of the tree by a rule and the bold weight, of the breadcrumb by the weight, of the pins by a fill and the weight, of the contents, the letters, the pages and the tabs by a rule or a fill and the weight", () => {
      expect(declarationsOf(".space-current > span")).toMatchObject({
        "border-inline-start": "3px solid var(--color-accent)",
        "font-weight": "600",
      });
      expect(declarationsOf('.breadcrumbs-list [aria-current="page"]')).toMatchObject({
        "font-weight": "500",
      });
      expect(declarationsOf(".toc-list a[aria-current]")).toMatchObject({
        "border-inline-start-color": "var(--color-accent)",
        "font-weight": "500",
      });
      expect(declarationsOf(".pin-current")).toMatchObject({
        background: "var(--color-ink)",
        "font-weight": "600",
      });
      expect(declarationsOf('.letter[aria-current="page"]')).toMatchObject({
        background: "var(--color-ink)",
        "font-weight": "600",
      });
      expect(declarationsOf('.category-pages [aria-current="page"]')).toMatchObject({
        "border-color": "var(--color-ink)",
        "font-weight": "600",
      });
      const tab = shipped.find((rule) =>
        selectorsOf(rule).includes('.tabs-scripted .tab[aria-selected="true"]'),
      );
      expect(tab?.declarations).toEqual({
        "border-block-end-color": "var(--color-accent)",
        color: "var(--color-ink)",
        "font-weight": "600",
      });
    });

    it("writes aria-current on the current page of every tree, once per tree, on a span and never on a link, and on the last step of every breadcrumb", () => {
      let trees = 0;
      let breadcrumbs = 0;
      for (const { path, html } of documents) {
        for (const [tree] of html.matchAll(/<nav class="space"[\s\S]*?<\/nav>/g)) {
          trees += 1;
          expect(count(tree, 'aria-current="page"'), path).toBe(1);
          expect(tree, path).toMatch(
            /<li class="space-(page|folder) space-current"><span (class="space-folder-name" )?aria-current="page">[^<]+/,
          );
        }
        for (const [crumbs] of html.matchAll(/<ol class="breadcrumbs-list">[\s\S]*?<\/ol>/g)) {
          breadcrumbs += 1;
          expect(crumbs, path).toMatch(/<li><span aria-current="page">[^<]+<\/span><\/li><\/ol>$/);
          expect(count(crumbs, "aria-current"), path).toBe(1);
        }
        expect(html, path).not.toMatch(/<a [^>]*aria-current="page"[^>]*class="space/);
      }
      expect(trees).toBeGreaterThan(10);
      expect(breadcrumbs).toBeGreaterThan(10);
    });

    it("marks the tab shown by aria-selected on one tab of the row", () => {
      const tabs = of("document-page-corporate.html");
      expect(count(tabs, 'aria-selected="true"')).toBe(1);
      expect(count(tabs, 'aria-selected="false"')).toBe(2);
    });
  });

  describe("a cited page: the word before the excerpt", () => {
    it("prefixes the excerpt of every cited related page with the word and of none other, on every page with a panel", () => {
      let cited = 0;
      for (const { path, html } of documents) {
        const main = mainOf(html);
        for (const [entry] of main.matchAll(/<li class="related-page[^"]*">[\s\S]*?<\/li>/g)) {
          const marked = entry.includes('<span class="related-mark">Cited · </span>');
          expect(marked, `${path}: ${entry.slice(0, 80)}`).toBe(
            entry.startsWith('<li class="related-page related-cited">'),
          );
          if (marked) cited += 1;
        }
      }
      expect(cited).toBeGreaterThan(10);
      expect(declarationsOf(".related-mark")).toEqual({ color: "var(--color-accent)" });
    });
  });

  describe("the freshness alert: worded, the accent doubled by words or a number", () => {
    it("words the alert of the home page in a card with the days and the threshold, and reads a dormant space of the spaces page in days with a hidden phrase after the date", () => {
      const home = of("home-corporate.html");
      expect(home).toContain(
        '<div class="home-alert"><h3>A space has not moved for 194 days</h3><p>framing. The alert threshold is set to 180 days in the configuration.</p></div>',
      );
      const spaces = of("spaces-corporate.html");
      const stale = /<tr class="spaces-row stale">[\s\S]*?<\/tr>/.exec(spaces)?.[0] ?? "";
      expect(stale).toContain(
        '<time datetime="2026-03-03">194 days ago</time><span class="visually-hidden">, past the freshness threshold</span>',
      );
      expect(count(spaces, "past the freshness threshold")).toBe(2);
      expect(declarationsOf(".spaces-row.stale .spaces-date")).toEqual({
        color: "var(--color-accent)",
      });
      expect(declarationsOf(".home-alert")).not.toHaveProperty("color");
    });
  });

  it("draws the accent on links, the current position, the marks and the one alert only, every use listed", () => {
    const accent = shipped
      .filter((rule) =>
        Object.values(rule.declarations).some((value) => value.includes("--color-accent")),
      )
      .map((rule) => rule.selector);
    expect(accent).toEqual([
      "a",
      "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible",
      ".pins-remove-all",
      ".space-current > span",
      ".markdown .written",
      ".markdown .recognised, .markdown .recognised-keyword",
      ".legend-written::before, .legend-recognised::before, .legend-keyword::before",
      ".toc-list a[aria-current]",
      ".related-clear",
      ".related-mark",
      ".neighbourhood-icon-centre",
      ".contract-operation > button, .contract-schema-list button",
      ".neighbourhood-graph .map-centre .map-shape",
      ".keyword-notice",
      ".passage-at",
      ".neighbour::before",
      '.tabs:not(.tabs-scripted):not(:has(.tabs-panel:target, .tabs-panel :target)) .tab:nth-child(1), .tabs:not(.tabs-scripted):has(.tabs-panel:nth-child(1):target, .tabs-panel:nth-child(1) :target) .tab:nth-child(1), .tabs:not(.tabs-scripted):has(.tabs-panel:nth-child(2):target, .tabs-panel:nth-child(2) :target) .tab:nth-child(2), .tabs:not(.tabs-scripted):has(.tabs-panel:nth-child(3):target, .tabs-panel:nth-child(3) :target) .tab:nth-child(3), .tabs:not(.tabs-scripted):has(.tabs-panel:nth-child(4):target, .tabs-panel:nth-child(4) :target) .tab:nth-child(4), .tabs-scripted .tab[aria-selected="true"]',
      ".cue-time",
      ".spaces-row.stale .spaces-date",
      ".document-page .document-rail a.current",
      ".decision-session",
      ".about-row.stale .about-date",
      ".page-notice",
      ".document-extracted-position",
      ".document-state-failed span",
    ]);
    expect(baseStylesheet()).toContain("a {\n  color: var(--color-accent);");
  });
});
