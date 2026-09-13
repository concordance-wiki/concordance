import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import type { Attribute, EntityPageProps } from "../../../src/slots.js";
import {
  EntityPage,
  HIGHLIGHTS_MAX,
  HIGHLIGHTS_WITH_BADGE,
} from "../../../src/theme/default/entity-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { entityPage } from "../../../src/gallery/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(overrides: Partial<EntityPageProps> = {}): string {
  return renderSlot("EntityPage", { ...entityPage, ...overrides }, defaultTheme);
}

function highlight(index: number): Attribute {
  return {
    name: `h${String(index)}`,
    label: `Highlight ${String(index)}`,
    values: [{ text: `value ${String(index)}` }],
  };
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

describe("EntityPage", () => {
  it("imposes the page order: type badge and two qualifying properties, title, then the rendered markdown at full column width", () => {
    const html = render();
    expectInOrder(html, [
      '<span class="badge">term</span>',
      '<span class="highlight-label">aliases</span>',
      '<span class="highlight-label">broader</span>',
      "<h1>Keyword page</h1>",
      '<article class="entity-body">',
      '<div class="markdown">',
      '<aside class="entity-panel"',
    ]);
    // Nothing but the header's closing tag stands between the title and the article.
    expect(html).toContain('<h1>Keyword page</h1></header><article class="entity-body">');
    expect(html.startsWith('<div class="entity"><header class="entity-header">')).toBe(true);
    expectBalanced(html);
  });

  it("renders the highlights next to the badge, linked when they have a target", () => {
    const html = render();
    expect(html).toContain(
      '<p class="entity-badge"><span class="badge">term</span><span class="highlight"><span class="highlight-label">aliases</span> <span class="value">word page</span></span>',
    );
    expect(html).toContain('<a class="value" href="../page/">page</a>');
    expect(html).not.toContain("entity-highlights");
  });

  it("keeps the declared metadata in the side panel, never between the title and the text", () => {
    const html = render();
    expectInOrder(html, [
      "<h1>Keyword page</h1>",
      '<article class="entity-body">',
      "</article>",
      '<aside class="entity-panel" aria-labelledby="entity-properties"><h2 id="entity-properties">Properties</h2>',
      '<dt>Owner</dt><dd><a class="value" href="../publication/">Publication</a></dd>',
    ]);
    expect(render({ attributes: [] })).not.toContain("entity-panel");
  });

  it("caps the highlighted properties at five, two with the badge and three under it; beyond that they stay in the panel", () => {
    const highlights = Array.from({ length: 7 }, (_, index) => highlight(index));
    const html = render({ highlights, attributes: highlights });
    expect(HIGHLIGHTS_WITH_BADGE).toBe(2);
    expect(HIGHLIGHTS_MAX).toBe(5);
    expect(count(html, '<span class="highlight">')).toBe(5);
    const badgeLine = html.slice(html.indexOf('<p class="entity-badge">'), html.indexOf("</p>"));
    expect(count(badgeLine, '<span class="highlight">')).toBe(2);
    expect(badgeLine).toContain("Highlight 1");
    expect(badgeLine).not.toContain("Highlight 2");
    const secondLine = html.slice(
      html.indexOf('<p class="entity-highlights">'),
      html.indexOf("<h1>"),
    );
    expect(count(secondLine, '<span class="highlight">')).toBe(3);
    expect(secondLine).toContain("Highlight 4");
    expect(secondLine).not.toContain("Highlight 5");
    const panel = html.slice(html.indexOf('<aside class="entity-panel"'));
    expect(panel).toContain("<dt>Highlight 5</dt>");
    expect(panel).toContain("<dt>Highlight 6</dt>");
  });

  it("serves every type with a single template: only the badge, the highlights and the neighbour order differ", () => {
    const term = render();
    const screen = render({
      entity: { ...entityPage.entity, type: "screen", typeLabel: "screen" },
      highlights: [highlight(0), highlight(1), highlight(2)],
      neighbours: {
        ...entityPage.neighbours,
        neighbours: entityPage.neighbours.neighbours.slice().reverse(),
      },
    });
    const skeleton = (html: string): string =>
      html
        .replace(/<p class="entity-badge">[\s\S]*?<\/p>/, "<badge-and-highlights/>")
        .replace(/<p class="entity-highlights">[\s\S]*?<\/p>/, "")
        .replace(/<figure[\s\S]*?<\/figure>/, "<map/>")
        .replace(/<ul id="neighbourhood-list"[\s\S]*?<\/ul>/, "<neighbours/>");
    expect(skeleton(screen)).toBe(skeleton(term));
    expect(screen).not.toBe(term);
    expect(screen).toContain('<p class="entity-badge"><span class="badge">screen</span>');
    expect(screen).toContain('<p class="entity-highlights">');
  });

  it("keeps the rendered markdown of every section as is, under its heading when it has one", () => {
    const html = render();
    expect(html).toContain(
      '<section id="definition"><div class="markdown"><p>A <a href="../page/" class="written">page</a>',
    );
    expect(html).toContain(
      '<section id="not-to-be-confused-with"><h2>Not to be confused with</h2><div class="markdown"><p>An entity page.</p></div></section>',
    );
  });

  it("distinguishes written links and recognised words in the text, with a legend under the article", () => {
    const html = render();
    expect(html).toContain('<a href="../page/" class="written">page</a>');
    expect(html).toContain('<a href="../occurrence/" class="recognised">occurrence</a>');
    const legend =
      '<footer class="legend"><span class="legend-written">link written in the note</span><span class="legend-recognised">word recognised at indexing</span></footer></article>';
    expect(html).toContain(legend);
    expect(html.indexOf(legend)).toBeGreaterThan(html.indexOf("<p>An entity page.</p>"));
    expect(render({ sections: [] })).toContain('<article class="entity-body"></article>');
  });

  it("renders the neighbourhood and the mentions through the slots of the theme", () => {
    const Marker = (): null => null;
    const theme = {
      components: { ...defaultTheme.components, Neighbourhood: Marker, MentionsPanel: Marker },
      overrides: [],
    };
    const html = renderSlot("EntityPage", entityPage, theme);
    expect(html).not.toContain("neighbourhood");
    expect(html).not.toContain("mentions");
    const withDefaults = render();
    expect(withDefaults).toContain('<section class="neighbourhood"');
    expect(withDefaults).toContain('<aside class="mentions"');
  });

  it("shows the source file path and an edit link to the forge in the footer, the link only when the forge is known", () => {
    const html = render();
    expect(html).toContain(
      '<footer class="entity-footer"><p class="entity-source">source: <code>glossary/keyword-page.md</code><a class="entity-edit" href="https://forge.example/glossary/edit/main/keyword-page.md">Edit in the forge</a></p></footer>',
    );
    const without = render({ sources: [{ source: "framing", path: "a.md" }] });
    expect(without).toContain('<p class="entity-source">source: <code>framing/a.md</code></p>');
    expect(without).not.toContain("entity-edit");
  });

  it("refuses to render outside a theme, naming the slot it needed", () => {
    expect(() => renderToString(h(EntityPage, entityPage))).toThrow(
      "useSlot(Neighbourhood): no theme in context; render through renderPage or renderSlot",
    );
  });
});
