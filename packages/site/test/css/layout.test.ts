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
    ]);
  });
});
