import { describe, expect, it } from "vitest";

import { baseStylesheet, componentsStylesheet } from "../../src/css/stylesheet.js";
import { galleryDocuments } from "../../src/gallery/build.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const islands = [
  { name: "contract-viewer", file: "contract-viewer-00000000.js", bytes: 0 },
  { name: "document-viewer", file: "document-viewer-00000000.js", bytes: 0 },
  { name: "gallery-width", file: "gallery-width-00000000.js", bytes: 0 },
  { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
  { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
  { name: "search", file: "search-00000000.js", bytes: 0 },
  { name: "tabs", file: "tabs-00000000.js", bytes: 0 },
  { name: "toc", file: "toc-00000000.js", bytes: 0 },
  { name: "panels", file: "panels-00000000.js", bytes: 0 },
  { name: "pins", file: "pins-00000000.js", bytes: 0 },
];
const documents = galleryDocuments(defaultTheme, islands);

/** Every rule of a stylesheet as `[selector, declarations]`, nested blocks flattened. */
function rules(css: string): [string, string][] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => [
    (match[1] ?? "").trim(),
    (match[2] ?? "").trim(),
  ]);
}

const FOCUSABLE =
  /<(a [^>]*href=|button|input(?! type="hidden")|select|textarea|summary|[a-z]+ [^>]*tabindex=)/g;

describe("Full keyboard navigation, consistent tab order, always-visible focus", () => {
  it("gives every interactive element the same focus-visible ring drawn with a token", () => {
    const focus = rules(baseStylesheet()).filter(([selector]) =>
      selector.includes(":focus-visible"),
    );
    expect(focus).toHaveLength(1);
    const [selector, declarations] = focus[0] ?? ["", ""];
    for (const element of ["a", "button", "input", "select", "textarea", "summary", "[tabindex]"]) {
      expect(selector).toContain(`${element}:focus-visible`);
    }
    expect(declarations).toContain("outline: 3px solid var(--color-accent);");
    expect(declarations).toContain("outline-offset: 2px;");
  });

  it("never removes an outline without a replacement, in the base layer or in the components layer", () => {
    for (const [selector, declarations] of [
      ...rules(baseStylesheet()),
      ...rules(componentsStylesheet()),
    ]) {
      expect(declarations, selector).not.toMatch(/outline:\s*(none|0|transparent)/);
      expect(declarations, selector).not.toMatch(
        /outline-(width|style|color):\s*(0|none|transparent)/,
      );
    }
  });

  it("keeps the skip link first in the document and visible on focus", () => {
    const base = rules(baseStylesheet());
    expect(base).toContainEqual([".skip-link:focus", "transform: none;\n  z-index: 1;"]);
    const hidden = base.find(([selector]) => selector === ".skip-link")?.[1] ?? "";
    expect(hidden).toContain("transform: translateY(-100%);");
    expect(hidden).toContain("color: var(--color-ink);");
    for (const { path, html } of documents) {
      const body = html.slice(html.indexOf("<body>"));
      const first = FOCUSABLE.exec(body);
      FOCUSABLE.lastIndex = 0;
      expect(first?.index, path).toBe(body.indexOf('<a class="skip-link" href="#main">'));
    }
  });

  it("orders every page skip link, header, main, footer, and never forces a tab order", () => {
    for (const { path, html } of documents) {
      const positions = [
        '<a class="skip-link" href="#main">',
        '<header class="site-header">',
        '<main id="main">',
        "</main>",
        '<footer class="site-footer">',
      ].map((marker) => html.indexOf(marker));
      expect(
        positions.every((position) => position > 0),
        path,
      ).toBe(true);
      expect(
        [...positions].sort((a, b) => a - b),
        path,
      ).toEqual(positions);
      expect(html, path).not.toMatch(/tabindex="[1-9]/);
      expect(html, path).not.toMatch(/ onclick=| onkeydown=/);
    }
  });

  it("serves the blocks of the panel behind native summaries, the related pages as plain links and the rest behind a link before hydration, real buttons after", () => {
    const island = documents.find((document) => document.path === "mentions-panel-island.html");
    const html = island?.html ?? "";
    // The header carries the mode switch button on every page: only the main landmark is inspected.
    const main = html.slice(html.indexOf('<main id="main">'), html.indexOf("</main>"));
    expect(main).toContain('<details class="panel-fold" open><summary><h2 id="mentions-title">');
    expect(main).toContain('<a class="related-title" href="../notes/note-1/">Note 1</a>');
    expect(main).toContain('<p class="mentions-more"><a href=');
    expect(main).not.toContain("<button");
    expect(main).not.toContain("<select");
    expect(main).not.toContain("<input");
    expect(baseStylesheet()).toContain(
      "summary {\n  display: flex;\n  align-items: center;\n  gap: var(--space-2);\n  cursor: pointer;",
    );
    expect(componentsStylesheet()).toContain(".mentions-more button {");
  });
});
