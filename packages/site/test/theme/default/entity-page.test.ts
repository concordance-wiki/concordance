import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { EntityPage } from "../../../src/theme/default/entity-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { entityPage } from "../../helpers/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("EntityPage", () => {
  it("imposes the order: badge and highlights, title, then the rendered markdown", () => {
    const html = renderSlot("EntityPage", entityPage, defaultTheme);
    const badge = html.indexOf('<span class="badge">term</span>');
    const title = html.indexOf("<h1>Free payment</h1>");
    const body = html.indexOf('<div class="entity-body">');
    const panel = html.indexOf('<aside class="entity-panel"');
    expect(badge).toBeGreaterThan(0);
    expect(badge).toBeLessThan(title);
    expect(title).toBeLessThan(body);
    expect(body).toBeLessThan(panel);
    expectBalanced(html);
  });

  it("renders the highlights next to the badge, linked when they have a target", () => {
    const html = renderSlot("EntityPage", entityPage, defaultTheme);
    expect(html).toContain(
      '<span class="highlight-label">aliases</span> <span class="value">FP</span><span class="value">free contribution</span>',
    );
    expect(html).toContain('<a class="value" href="../payment/">payment</a>');
  });

  it("caps the highlights at five", () => {
    const highlights = Array.from({ length: 7 }, (_, index) => ({
      name: `h${String(index)}`,
      label: `Highlight ${String(index)}`,
      values: [{ text: String(index) }],
    }));
    const html = renderSlot("EntityPage", { ...entityPage, highlights }, defaultTheme);
    expect(count(html, '<span class="highlight">')).toBe(5);
    expect(html).not.toContain("Highlight 5");
  });

  it("keeps the markdown of every section as is, under its heading when it has one", () => {
    const html = renderSlot("EntityPage", entityPage, defaultTheme);
    expect(html).toContain(
      '<section id="definition"><div class="markdown"><p>A <a class="written" href="../payment/">payment</a>',
    );
    expect(html).toContain(
      '<section id="not-to-be-confused-with"><h2>Not to be confused with</h2><div class="markdown"><p>An exceptional payment.</p></div></section>',
    );
    expect(html).toContain('<span class="legend-written">link written in the note</span>');
  });

  it("puts the declared metadata in the side panel and omits the panel when there is none", () => {
    const html = renderSlot("EntityPage", entityPage, defaultTheme);
    expect(html).toContain(
      '<aside class="entity-panel" aria-labelledby="entity-properties"><h2 id="entity-properties">Properties</h2>',
    );
    expect(html).toContain('<dt>Owner</dt><dd><a class="value" href="../claims/">Claims</a></dd>');
    expect(renderSlot("EntityPage", { ...entityPage, attributes: [] }, defaultTheme)).not.toContain(
      "entity-panel",
    );
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
    const withDefaults = renderSlot("EntityPage", entityPage, defaultTheme);
    expect(withDefaults).toContain('<section class="neighbourhood"');
    expect(withDefaults).toContain('<aside class="mentions"');
  });

  it("shows the source path and the edit link in the footer, the link only when the forge is known", () => {
    const html = renderSlot("EntityPage", entityPage, defaultTheme);
    expect(html).toContain(
      '<p class="entity-source"><code>glossary/free-payment.md</code><a class="entity-edit" href="https://forge.example/edit/glossary/free-payment.md">Edit in the forge</a></p>',
    );
    const without = renderSlot(
      "EntityPage",
      { ...entityPage, sources: [{ path: "a.md" }] },
      defaultTheme,
    );
    expect(without).toContain("<code>a.md</code></p>");
  });

  it("refuses to render outside a theme, naming the slot it needed", () => {
    expect(() => renderToString(h(EntityPage, entityPage))).toThrow(
      "useSlot(Neighbourhood): no theme in context; render through renderPage or renderSlot",
    );
  });
});
