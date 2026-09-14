import { describe, expect, it } from "vitest";

import { baseStylesheet, componentsStylesheet } from "../../src/css/stylesheet.js";

const base = baseStylesheet();
const components = componentsStylesheet();

/**
 * Every `font-size` of a stylesheet in rem, em values set aside since they scale their parent,
 * and the map of the neighbourhood too: its glyphs are drawn in the units of its viewBox.
 */
function fontSizesInRem(css: string): number[] {
  const text = css.replace(/\.neighbourhood-graph[^{]*\{[^}]*\}/g, "");
  return [...text.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)].map((match) => {
    const value = Number(match[1]);
    return match[2] === "px" ? value / 16 : value;
  });
}

/** The rules inside every block of one media query, joined. */
function media(css: string, query: string): string {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(`@media ${query} {`, from);
    if (start < 0) break;
    let depth = 0;
    let end = start;
    for (let at = css.indexOf("{", start); at < css.length; at += 1) {
      if (css[at] === "{") depth += 1;
      if (css[at] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = at + 1;
          break;
        }
      }
    }
    blocks.push(css.slice(start, end));
    from = end;
  }
  expect(blocks.length, query).toBeGreaterThan(0);
  return blocks.join("\n");
}

describe("Three widths: three columns from 1100 px, the tree folded from 700 px, one column under it", () => {
  it("lays the entity page out in one column by default: the tree, the text, the panel", () => {
    expect(components).toContain(
      '.entity {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  grid-template-areas:\n    "space"\n    "main"\n    "side";\n}',
    );
  });

  it("pads the centre column 18 by 16 px on the phone, 20 px on the tablet and 30 by 40 px on the desktop", () => {
    expect(components).toContain(
      ".entity-main {\n  grid-area: main;\n  min-inline-size: 0;\n  padding: 1.125rem 1rem var(--space-5);\n}",
    );
    expect(media(components, "(min-width: 43.75rem)")).toContain(
      ".entity-main {\n    padding: 1.25rem 1.25rem var(--space-5);\n  }",
    );
    expect(media(components, "(min-width: 68.75rem)")).toContain(
      ".entity-main {\n    padding: 1.875rem 2.5rem var(--space-5);\n  }",
    );
  });

  it("puts the panel beside the text from 700 px, the tree folded behind its name above them", () => {
    const medium = media(components, "(min-width: 43.75rem)");
    expect(medium).toContain('grid-template-areas:\n      "space space"\n      "main side";');
    expect(medium).toContain("grid-template-columns: minmax(0, 1fr) minmax(18rem, 21.5rem);");
    // The blocks of the panel are served folded; from here the stylesheet keeps their content in view.
    expect(medium).toContain(
      ".panel-fold::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(medium).toContain(".panel-fold > summary::before {\n    content: none;\n  }");
    expect(medium).not.toContain(".space-tree::details-content");
  });

  it("gives the tree its own column from 1100 px, the content of its disclosure kept in view", () => {
    const wide = media(components, "(min-width: 68.75rem)");
    expect(wide).toContain(
      '.entity-with-space {\n    grid-template-columns: 16rem minmax(0, 1fr) 21.5rem;\n    grid-template-areas: "space main side";\n  }',
    );
    expect(wide).toContain(
      '.entity {\n    grid-template-columns: minmax(0, 1fr) 21.5rem;\n    grid-template-areas: "main side";\n  }',
    );
    expect(wide).toContain(
      ".space-tree::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(wide).toContain(".space-head::before {\n    content: none;\n  }");
  });

  it("serves the tree and every block of the panel as a disclosure, closed, so that a narrow page folds them without any script", () => {
    expect(components).toContain(".panel-fold > summary {");
    expect(components).toContain(".space-tree {");
    expect(components).toContain(".neighbourhood-fold > summary {");
  });
});

describe("Targets of 40 to 44 pixels, text never under 13 pixels", () => {
  it("gives every button, field, select and summary a minimum height of 40 px in the base layer", () => {
    expect(base).toContain(
      'button,\ninput:not([type="checkbox"]):not([type="radio"]),\nselect,\nsummary {\n  min-block-size: 2.5rem;\n}',
    );
  });

  it("gives the links of the bar, the tree, the breadcrumb, the table of contents and the footer a target of 40 px", () => {
    for (const selector of [
      ".site-links a",
      ".site-title",
      ".space-folder-name,\n.space-page > a,\n.space-page > span",
      ".breadcrumbs-list a",
      ".toc-list a",
      ".site-footer-links a",
      ".mentions-more a",
      ".chip",
    ]) {
      const at = components.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      const body = components.slice(at, components.indexOf("}", at));
      expect(body, selector).toContain("min-block-size: 2.5rem;");
    }
    expect(components).toContain(".panel-fold > summary {\n  min-block-size: 3rem;");
    expect(components).toContain(".space-head {\n  min-block-size: 3.5rem;");
  });

  it("writes no font size under 13 px in either stylesheet", () => {
    const sizes = [...fontSizesInRem(base), ...fontSizesInRem(components)];
    expect(sizes.length).toBeGreaterThan(40);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.8125);
    // The monospace family is sized relative to its parent but never under 13 px either.
    expect(base).toContain("font-size: max(0.9375em, 0.8125rem);");
  });

  it("uses one family for the text, headings included, and the monospace family for paths and identifiers only", () => {
    expect(base).toContain("h1 {\n  font-family: var(--font-display);");
    expect(base.match(/font-family: var\(--font-mono\)/g)).toHaveLength(1);
    expect(base).toContain("code,\npre,\nkbd {\n  font-family: var(--font-mono);");
    const monospace = [
      ...components.matchAll(/^([^{}]+)\{[^}]*font-family: var\(--font-mono\)/gm),
    ].map((match) => (match[1] ?? "").trim());
    expect(monospace).toEqual([
      ".count",
      ".site-footer-card > .site-footer-build",
      ".related-count",
      ".letter",
      ".index-table .index-pages",
      ".passage-count",
      ".passage-at",
      ".similar-count",
      ".neighbour > .weight",
      ".result-cited-count",
      ".cue-time",
      ".spaces-table .spaces-count",
      ".space-category-count",
      ".chip-count",
      ".api-method",
      ".contract-format",
      ".category-table tbody .category-links",
      ".document-page .document-rail a",
      ".viewer-counter",
      ".document-twin-name",
      ".about-table .about-version",
      ".about-table .about-content",
    ]);
  });
});

describe("Mobile first: the base layer is the phone's, the tablet and the desktop add their columns", () => {
  it("reduces the bar to the menu button, the name and the magnifier: the mode switch is folded away, the menu button is a 48 px bordered square drawn as ☰, as ✕ in the ink once open, the search button a 40 px square whose word is hidden", () => {
    expect(components).toContain(
      '.site-nav > concordance-island[data-island="mode-switch"] {\n  display: none;\n}',
    );
    expect(components).toContain(
      ".site-menu {\n  flex: none;\n  justify-content: center;\n  inline-size: 3rem;\n  min-block-size: 3rem;\n  margin-inline-start: calc(-1 * var(--space-2));\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius);\n  background: var(--color-bg);",
    );
    expect(components).toContain('.site-menu::before {\n  content: "☰" / "";');
    expect(components).toContain(
      ".site-drawer[open] > .site-menu {\n  border-color: var(--color-ink);\n  background: var(--color-ink);\n}",
    );
    expect(components).toContain(
      '.site-drawer[open] > .site-menu::before {\n  content: "✕" / "";\n  color: var(--color-bg);\n}',
    );
    expect(components).toContain(".site-title {\n  flex: 1;\n  min-inline-size: 0;\n}");
    expect(components).toContain(
      ".site-name {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}",
    );
    expect(components).toContain(".site-search-fold {\n  position: relative;\n  flex: none;\n}");
    expect(components).toContain(
      ".site-search-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  inline-size: 2.5rem;\n  block-size: 2.5rem;\n  padding: 0;\n  border: 1px solid var(--color-border);",
    );
    expect(components).toContain(".site-search-button::before {\n  content: none;\n}");
    expect(components).toContain(
      ".site-search-label {\n  position: absolute;\n  inline-size: 1px;\n  block-size: 1px;",
    );
  });

  it("orders the folded sections of the phone with the table of contents first, reads the neighbourhood line as the others with the bare count, and leaves the legend out of the foot", () => {
    const phone = media(components, "(width < 43.75rem)");
    expect(phone).toContain(".entity-side {\n    display: flex;\n    flex-direction: column;\n  }");
    expect(phone).toContain(".entity-toc {\n    order: -1;\n  }");
    expect(phone).toContain(
      ".panel-fold > summary h2 {\n    color: var(--color-ink);\n    letter-spacing: 0;\n    text-transform: none;\n  }",
    );
    expect(phone).toContain(
      ".mentions-controls,\n  .related-type,\n  .related-note {\n    display: none;\n  }",
    );
    expect(phone).toContain(".neighbourhood-fold > summary {\n    font-weight: 600;\n  }");
    expect(phone).toContain(
      ".neighbourhood-fold:not([open]) > summary > .neighbourhood-icon,\n  .neighbourhood-fold:not([open]) > summary > .neighbourhood-lead,\n  .neighbourhood-fold:not([open]) > summary > .neighbourhood-count {\n    display: none;\n  }",
    );
    expect(phone).toContain(
      ".neighbourhood-fold:not([open]) > summary > .neighbourhood-head {\n    display: inline;\n    flex: 1;\n  }",
    );
    expect(phone).toContain(
      ".neighbourhood-fold:not([open]) > summary > .neighbourhood-number {\n    order: 1;\n  }",
    );
    expect(phone).toContain(
      ".neighbourhood-fold[open] > summary > .neighbourhood-number {\n    display: none;\n  }",
    );
    expect(phone).toContain(".entity-footer > .legend {\n    display: none;\n  }");
  });

  it("reads the foot of the article on the phone as the name of the file and the short edit label on one line of 48 px, the folders and the question left out", () => {
    expect(components).toContain(".entity-edit-short {\n  display: none;\n}");
    const phone = media(components, "(width < 43.75rem)");
    expect(phone).toContain(
      ".entity-footer > .entity-source {\n    flex: 1;\n    flex-wrap: nowrap;\n    min-block-size: 3rem;\n  }",
    );
    expect(phone).toContain(
      ".entity-source-folders,\n  .entity-edit-question,\n  .entity-edit-long {\n    display: none;\n  }",
    );
    expect(phone).toContain(".entity-edit-short {\n    display: inline;\n  }");
  });

  it("folds the trail behind a square button of the bar, the island hidden while its script lists no page, the list unfolded under the bar", () => {
    expect(components).toContain(
      'concordance-island[data-island="trail"] {\n  position: relative;\n  flex: none;\n}\n\nconcordance-island[data-island="trail"]:empty {\n  display: none;\n}',
    );
    expect(components).toContain(
      ".trail-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  inline-size: 2.5rem;\n  block-size: 2.5rem;",
    );
    expect(components).toContain(".trail-button::before {\n  content: none;\n}");
    expect(components).toContain(
      ".trail {\n  position: absolute;\n  inset-inline-end: 0;\n  inset-block-start: calc(100% + var(--space-1));\n  z-index: 3;",
    );
    expect(components).toContain(
      ".trail-list a {\n  display: flex;\n  align-items: center;\n  min-block-size: 2.5rem;",
    );
  });

  it("gives every entry of the drawer a 48 px target and hides the tree of the column, the breadcrumb ancestors, the space and the long date on the phone", () => {
    expect(components).toContain(
      ".drawer-spaces-title,\n.drawer-space-list a,\n.drawer .site-links a {\n  display: flex;\n  align-items: center;\n  gap: var(--space-2);\n  min-block-size: 3rem;",
    );
    expect(components).toContain(
      ".drawer-space .space-head,\n.drawer-space .space-folder-name,\n.drawer-space .space-page > a,\n.drawer-space .space-page > span {\n  min-block-size: 3rem;\n}",
    );
    expect(components).toContain(".entity > .space {\n  display: none;\n}");
    expect(components).toContain(
      ".breadcrumbs-list > li:not(:nth-last-child(-n + 2)) {\n  display: none;\n}",
    );
    expect(components).toContain(
      ".entity-badge > .entity-space,\n.entity-changed-long {\n  display: none;\n}",
    );
    // The related pages beyond the first three are folded behind their count wherever the panel has no full column.
    expect(components).toContain(
      ".related-others > summary {\n  display: flex;\n  min-block-size: 2.5rem;\n  color: var(--color-muted);\n  font-size: 0.8125rem;\n  font-weight: 500;\n  list-style: none;\n}",
    );
  });

  it("opens the drawer over the whole screen under the desktop width: the header fixed, the search field first, the content then the mode switch, the button of the trail hidden", () => {
    const narrow = media(components, "(width < 68.75rem)");
    expect(narrow).toContain(
      ".site-header:has(.site-drawer[open]) {\n    position: fixed;\n    inset: 0;\n    z-index: 3;\n    overflow-y: auto;\n  }",
    );
    expect(narrow).toContain("body:has(.site-drawer[open]) {\n    overflow: hidden;\n  }");
    expect(narrow).toContain(
      ".site-drawer[open],\n  .site-drawer[open]::details-content {\n    display: contents;\n  }",
    );
    expect(narrow).toContain(".drawer {\n    flex-basis: 100%;\n    order: 2;");
    expect(narrow).toContain(
      ".site-drawer[open] ~ .site-search-fold {\n    display: block;\n    flex-basis: 100%;\n    order: 1;",
    );
    expect(narrow).toContain(
      ".site-drawer[open] ~ .site-search-fold::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(narrow).toContain(
      '.site-drawer[open] ~ concordance-island[data-island="mode-switch"] {\n    display: block;\n    flex-basis: 100%;\n    order: 3;\n  }',
    );
    expect(narrow).toContain(
      '.site-drawer[open] ~ concordance-island[data-island="trail"] {\n    display: none;\n  }',
    );
    // The magnifier of a closed drawer unfolds the field under itself, on the phone as on the tablet.
    expect(narrow).toContain(
      '.site-drawer:not([open]) ~ .site-search-fold[open] > concordance-island[data-island="search"] {\n    position: absolute;',
    );
  });

  it("reads the search button as a small field after the name from 700 px, adds the mode switch to the bar, and restores the breadcrumb, the space and the long date", () => {
    const medium = media(components, "(min-width: 43.75rem)");
    expect(medium).toContain(".site-title {\n    flex: none;\n  }");
    expect(medium).toContain(
      ".site-search-fold {\n    flex: 1;\n    max-inline-size: 9.375rem;\n    margin-inline-end: auto;\n  }",
    );
    expect(medium).toContain(
      ".site-search-button {\n    inline-size: 100%;\n    justify-content: flex-start;\n    gap: var(--space-2);\n    padding-inline: var(--space-2);\n    border: 0;\n    background: var(--color-soft);",
    );
    expect(medium).toContain(".site-search-label {\n    position: static;");
    expect(medium).toContain(
      '.site-nav > concordance-island[data-island="mode-switch"] {\n    display: block;\n  }',
    );
    expect(medium).toContain(
      ".breadcrumbs-list > li:not(:nth-last-child(-n + 2)) {\n    display: block;\n  }",
    );
    expect(medium).toContain(".entity-changed-short,\n  .panel-count {\n    display: none;\n  }");
  });

  it("condenses the panel between 700 and 1099 px: the values of the properties alone, three related titles and the others folded, the neighbourhood at the foot of the page", () => {
    const tablet = media(components, "(43.75rem <= width < 68.75rem)");
    expect(tablet).toContain(
      ".entity {\n    grid-template-columns: minmax(0, 1fr) 11.625rem;\n    grid-template-areas: none;\n  }",
    );
    expect(tablet).toContain(".entity-side > .entity-toc {\n    display: none;\n  }");
    expect(tablet).toContain(".entity-main {\n    grid-area: 1 / 1 / 7 / 2;");
    expect(tablet).toContain(".entity-side {\n    display: contents;\n  }");
    expect(tablet).toContain(".entity-side > .panel-block {\n    grid-column: 2;");
    expect(tablet).toContain(".entity-side > .neighbourhood-fold {\n    grid-area: 7 / 1 / 8 / 3;");
    expect(tablet).toContain(
      ".entity-panel .attributes dt {\n    position: absolute;\n    inline-size: 1px;\n    block-size: 1px;",
    );
    expect(tablet).toContain(
      ".mentions-controls,\n  .related-type,\n  .related-count,\n  .related-excerpt,\n  .related-note {\n    display: none;\n  }",
    );
    expect(tablet).not.toContain(".related-others > summary");
    expect(tablet).not.toContain(".related-others:not([open])::details-content");
    expect(tablet).toContain(
      ".related-others:not([open]) ~ .related-beyond,\n  .related-others:not([open]) ~ .mentions-more {\n    display: none;\n  }",
    );
  });

  it("keeps the desktop as it was from 1100 px: the menu button gone, the links and the search field of the drawer in view in the bar, the tree back in its column", () => {
    const wide = media(components, "(min-width: 68.75rem)");
    expect(wide).toContain(".site-menu {\n    display: none;\n  }");
    expect(wide).toContain(
      ".site-drawer::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(wide).toContain(".drawer-space-list,\n  .drawer-space {\n    display: none;\n  }");
    expect(wide).toContain(
      ".drawer .site-links {\n    flex-direction: row;\n    align-items: center;\n    gap: var(--space-3);",
    );
    expect(wide).toContain(".site-search-button {\n    display: none;\n  }");
    expect(wide).toContain(
      ".site-search-fold::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(wide).toContain(
      ".related-others::details-content {\n    display: block;\n    content-visibility: visible;\n  }\n\n  .related-others > summary {\n    display: none;\n  }",
    );
    expect(wide).toContain(".entity > .space {\n    display: block;\n  }");
  });
});

describe("Search results: the facets in a column from 700 px, folded above the list under it, every control a target", () => {
  it("gives the facets a 250 px column from 700 px, as tall as the page and ruled on its right, keeps their disclosure in view and its head for assistive technology alone", () => {
    const medium = media(components, "(min-width: 43.75rem)");
    expect(medium).toContain(
      ".results-layout {\n    grid-template-columns: 15.625rem minmax(0, 1fr);\n    min-block-size: calc(100vh - 3.5rem);\n  }",
    );
    expect(medium).toContain(
      ".facets {\n    border-block-end: 0;\n    border-inline-end: 1px solid var(--color-border);\n  }",
    );
    expect(medium).toContain(
      ".facets-fold::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(medium).toContain(
      ".facets-head {\n    position: absolute;\n    inline-size: 1px;\n    block-size: 1px;",
    );
    expect(medium).toContain(".facets-head::before {\n    content: none;\n  }");
    expect(medium).toContain(
      ".facet-groups {\n    box-sizing: border-box;\n    min-block-size: 100%;\n    padding: 1.5rem 1.125rem;\n  }",
    );
    expect(components).toContain(
      ".results-layout {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  align-items: stretch;\n}",
    );
    expect(components).toContain(
      ".search-results {\n  max-inline-size: none;\n  margin: 0;\n  padding: 0;\n}",
    );
    expect(components).toContain(".facets {\n  border-block-end: 1px solid var(--color-border);");
    expect(components).not.toContain(".facets {\n  border: 1px solid");
  });

  it("expands the first row alone, with its title at 19 px and its facts, and condenses the others on one line with the bare count in the monospace family", () => {
    expect(components).toContain(
      ".result-lead .result-title {\n  overflow: visible;\n  font-size: 1.1875rem;\n  white-space: normal;\n}",
    );
    expect(components).toContain(
      ".result-title {\n  min-inline-size: 0;\n  overflow: hidden;\n  color: var(--color-ink);\n  font-size: 1rem;",
    );
    expect(components).toContain(
      ".snippet {\n  margin: 0;\n  overflow: hidden;\n  color: var(--color-muted);\n  font-size: 0.90625rem;\n  line-height: 1.7;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}",
    );
    expect(components).toContain(
      ".result-lead .snippet {\n  overflow: visible;\n  color: var(--color-ink);\n  font-size: 0.9375rem;",
    );
    expect(components).toContain(".result-cited-count {\n  font-family: var(--font-mono);\n}");
    expect(components).toContain(
      ".results-more {\n  inline-size: 100%;\n  min-block-size: 2.5rem;",
    );
    expect(components).not.toContain(".search-address");
  });

  it("lifts the measure of the header field from the island of the results page, which is the page itself", () => {
    expect(components).toContain(
      'main > concordance-island[data-island="search"] {\n  max-inline-size: none;\n}',
    );
  });

  it("gives the boxes of the facets, the chips of the active filters and the clear links a target of 40 px, and draws the keyword type dashed", () => {
    for (const selector of [
      ".facet-value",
      ".facet-value label",
      ".remove-filter",
      ".clear-filters a",
      ".search-clear",
    ]) {
      const at = components.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      const body = components.slice(at, components.indexOf("}", at));
      expect(body, selector).toMatch(/min-(block-size|inline-size): 2\.5rem;/);
    }
    expect(components).toContain(".facet-keyword input {\n  border-style: dashed;\n}");
    expect(components).toContain(
      ".result-keyword {\n  flex-direction: row;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.875rem;\n  border-style: dashed;\n}",
    );
    expect(components).toContain(
      ".result-keyword .result-title {\n  overflow: visible;\n  text-decoration: underline dotted;",
    );
    expect(components).toContain(
      ".facet-active label {\n  color: var(--color-ink);\n  font-weight: 600;\n}",
    );
  });
});
