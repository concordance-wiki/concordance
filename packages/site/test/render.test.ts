import { describe, expect, it } from "vitest";

import type { IslandBundle } from "../src/islands/bundle.js";
import { directionOf, renderPage, renderSlot, type RenderOptions } from "../src/render.js";
import { defaultTheme } from "../src/theme/resolve.js";
import { entityPage, footer, header, home, mentions, todo } from "../src/gallery/fixtures.js";
import { count, expectBalanced } from "./helpers/html.js";

const bundle: IslandBundle = { name: "mentions-panel", file: "mentions-panel-ABC123.js", bytes: 1 };

function options(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    theme: defaultTheme,
    locale: "en",
    title: "Free payment",
    stylesheets: ["../assets/site.css"],
    islands: [bundle],
    assetsBase: "../assets/",
    header,
    footer,
    ...overrides,
  };
}

describe("renderPage", () => {
  it("writes a complete document with the doctype, the language and the direction", () => {
    const html = renderPage("Todo", todo, options());
    expect(html.startsWith('<!doctype html>\n<html lang="en" dir="ltr">')).toBe(true);
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain("<title>Free payment</title>");
    expect(html).toContain('<link rel="stylesheet" href="../assets/site.css"');
    expect(html.endsWith("</html>\n")).toBe(true);
    expectBalanced(html);
  });

  it("composes the header, the main landmark with the page and the footer inside the shell", () => {
    const html = renderPage("Todo", todo, options());
    expect(html.indexOf('<header class="site-header">')).toBeLessThan(
      html.indexOf('<main id="main">'),
    );
    expect(html.indexOf('<main id="main">')).toBeLessThan(
      html.indexOf('<footer class="site-footer">'),
    );
    expect(html).toContain('<a class="skip-link" href="#main">Skip to content</a>');
    expect(count(html, "<h1>")).toBe(1);
  });

  it("emits no script for a page without an island", () => {
    const html = renderPage("EntityPage", entityPage, options());
    expect(html).not.toContain("<script");
    expect(html).not.toContain("modulepreload");
    expect(html).not.toContain("<concordance-island");
  });

  it("preloads and defers the bundle of every island the page uses, once each", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(25), initial: 20 } };
    const html = renderPage("EntityPage", page, options());
    expect(html).toContain('<link rel="modulepreload" href="../assets/mentions-panel-ABC123.js"');
    expect(html).toContain(
      '<script type="module" defer src="../assets/mentions-panel-ABC123.js"></script>',
    );
    expect(count(html, "<script")).toBe(1);
    expect(html).toContain('<concordance-island data-island="mentions-panel"');
    expectBalanced(html);
  });

  it("resolves bundle hrefs relative to the page root when no assets base is given", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(21), initial: 20 } };
    const { assetsBase, ...rest } = options();
    expect(assetsBase).toBe("../assets/");
    const html = renderPage("EntityPage", page, rest);
    expect(html).toContain('src="mentions-panel-ABC123.js"');
  });

  it("fails when a page uses an island that was not bundled", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(21), initial: 20 } };
    expect(() => renderPage("EntityPage", page, options({ islands: [] }))).toThrow(
      "renderPage: island mentions-panel has no bundle",
    );
  });

  it("escapes the serialised props so that a closing script tag in the data cannot break the page", () => {
    const hostile = mentions(21).map((item) => ({
      ...item,
      context: '</script><script>alert("x")</script>',
    }));
    const html = renderPage(
      "EntityPage",
      { ...entityPage, mentions: { mentions: hostile, initial: 20 } },
      options(),
    );
    expect(html).not.toContain("</script><script>");
    expect(html).toContain("&lt;/script>&lt;script>alert(&quot;x&quot;)&lt;/script>");
    expect(count(html, "<script")).toBe(1);
  });

  it("writes dir=rtl for a right-to-left locale", () => {
    const html = renderPage("Home", home, options({ locale: "ar" }));
    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it("gives the same bytes for the same page twice", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(25), initial: 20 } };
    expect(renderPage("EntityPage", page, options())).toBe(
      renderPage("EntityPage", page, options()),
    );
  });
});

describe("directionOf", () => {
  it("answers rtl for the right-to-left languages, whatever the region or the case", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("HE-IL")).toBe("rtl");
    expect(directionOf("fa")).toBe("rtl");
    expect(directionOf("ur")).toBe("rtl");
  });

  it("answers ltr for every other tag, the empty one included", () => {
    expect(directionOf("fr-CA")).toBe("ltr");
    expect(directionOf("")).toBe("ltr");
  });
});

describe("renderSlot", () => {
  it("renders one slot inside the theme, without the shell", () => {
    const html = renderSlot("Footer", footer, defaultTheme);
    expect(html.startsWith('<footer class="site-footer">')).toBe(true);
    expect(html).not.toContain("<html");
  });
});
