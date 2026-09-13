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

describe("Three widths: three columns from 1180 px, the tree folded from 768 px, one column under it", () => {
  it("lays the entity page out in one column by default: the tree, the text, the panel", () => {
    expect(components).toContain(
      '.entity {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  grid-template-areas:\n    "space"\n    "main"\n    "side";\n}',
    );
  });

  it("puts the panel beside the text from 768 px, the tree folded behind its name above them", () => {
    const medium = media(components, "(min-width: 48rem)");
    expect(medium).toContain('grid-template-areas:\n      "space space"\n      "main side";');
    expect(medium).toContain("grid-template-columns: minmax(0, 1fr) minmax(18rem, 21.5rem);");
    // The blocks of the panel are served folded; from here the stylesheet keeps their content in view.
    expect(medium).toContain(
      ".panel-fold::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(medium).toContain(".panel-fold > summary::before {\n    content: none;\n  }");
    expect(medium).not.toContain(".space-tree::details-content");
  });

  it("gives the tree its own column from 1180 px, the content of its disclosure kept in view", () => {
    const wide = media(components, "(min-width: 73.75rem)");
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
      ".related-count",
      ".passage-count",
      ".passage-at",
      ".similar-count",
      ".neighbour > .weight",
    ]);
  });
});

describe("Mobile first: the base layer is the phone's, the tablet and the desktop add their columns", () => {
  it("reduces the bar to the menu button and the name: the search field and the mode switch are folded away, the button is a 48 px target drawn as ☰, as ✕ once open", () => {
    expect(components).toContain(
      '.site-search-fold,\n.site-nav > concordance-island[data-island="mode-switch"] {\n  display: none;\n}',
    );
    expect(components).toContain(
      ".site-menu {\n  flex: none;\n  justify-content: center;\n  inline-size: 3rem;\n  min-block-size: 3rem;",
    );
    expect(components).toContain('.site-menu::before {\n  content: "☰" / "";');
    expect(components).toContain('.site-drawer[open] > .site-menu::before {\n  content: "✕" / "";');
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
    // The related pages beyond the first three are only folded where the panel is condensed.
    expect(components).toContain(
      ".related-others::details-content {\n  display: block;\n  content-visibility: visible;\n}\n\n.related-others > summary {\n  display: none;\n}",
    );
  });

  it("opens the drawer over the whole screen under the desktop width: the header fixed, the search field first, the content then the mode switch, the trail hidden", () => {
    const narrow = media(components, "(width < 73.75rem)");
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
      '.site-header:has(.site-drawer[open]) > concordance-island[data-island="trail"] {\n    display: none;\n  }',
    );
  });

  it("adds the search button and the mode switch to the bar from 768 px, and restores the breadcrumb, the space and the long date", () => {
    const medium = media(components, "(min-width: 48rem)");
    expect(medium).toContain(
      ".site-search-fold {\n    display: block;\n    position: relative;\n    margin-inline-start: auto;\n  }",
    );
    expect(medium).toContain(".site-search-button {\n    display: inline-flex;");
    expect(medium).toContain(
      '.site-nav > concordance-island[data-island="mode-switch"] {\n    display: block;\n  }',
    );
    expect(medium).toContain(
      ".breadcrumbs-list > li:not(:nth-last-child(-n + 2)) {\n    display: block;\n  }",
    );
    expect(medium).toContain(".entity-changed-short,\n  .panel-count {\n    display: none;\n  }");
  });

  it("condenses the panel between 768 and 1179 px: the values of the properties alone, three related titles and the others folded, the neighbourhood at the foot of the page, the search field unfolded under its button", () => {
    const tablet = media(components, "(48rem <= width < 73.75rem)");
    expect(tablet).toContain(
      '.site-drawer:not([open]) ~ .site-search-fold[open] > concordance-island[data-island="search"] {\n    position: absolute;',
    );
    expect(tablet).toContain(".entity {\n    grid-template-areas: none;\n  }");
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
    expect(tablet).toContain(
      ".related-others:not([open])::details-content {\n    display: none;\n  }",
    );
    expect(tablet).toContain(
      ".related-others > summary {\n    display: flex;\n    min-block-size: 2.5rem;",
    );
  });

  it("keeps the desktop as it was from 1180 px: the menu button gone, the links and the search field of the drawer in view in the bar, the tree back in its column", () => {
    const wide = media(components, "(min-width: 73.75rem)");
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
    expect(wide).toContain(".entity > .space {\n    display: block;\n  }");
  });
});

describe("Search results: the facets in a column from 768 px, folded above the list under it, every control a target", () => {
  it("gives the facets a 16 rem column from 768 px and keeps their disclosure in view, the marker of its head gone", () => {
    const medium = media(components, "(min-width: 48rem)");
    expect(medium).toContain(
      ".results-layout {\n    grid-template-columns: 16rem minmax(0, 1fr);\n  }",
    );
    expect(medium).toContain(
      ".facets-fold::details-content {\n    display: block;\n    content-visibility: visible;\n  }",
    );
    expect(medium).toContain(".facets-head::before {\n    content: none;\n  }");
    expect(components).toContain(
      ".results-layout {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);",
    );
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
    expect(components).toContain(".result-keyword {\n  border-style: dashed;\n}");
    expect(components).toContain(
      ".result-keyword .result-title {\n  text-decoration: underline dotted;",
    );
    expect(components).toContain(
      ".facet-active label {\n  color: var(--color-ink);\n  font-weight: 600;\n}",
    );
  });
});
