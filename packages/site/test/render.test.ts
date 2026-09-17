import { describe, expect, it } from "vitest";

import type { IslandBundle } from "../src/islands/bundle.js";
import { h } from "preact";
import { MODE_SCRIPT } from "../src/mode.js";
import { PANELS_SCRIPT } from "../src/panels.js";
import { renderPage, renderSlot, type RenderOptions } from "../src/render.js";
import type { ShellProps } from "../src/slots.js";
import { defaultComponents } from "../src/theme/default/index.js";
import { defaultTheme } from "../src/theme/resolve.js";
import type { ResolvedTheme } from "../src/theme/types.js";
import { entityPage, footer, header, home, mentions, todo } from "../src/gallery/fixtures.js";
import { count, expectBalanced } from "./helpers/html.js";

const bundle: IslandBundle = { name: "mentions-panel", file: "mentions-panel-ABC123.js", bytes: 1 };
const modeBundle: IslandBundle = { name: "mode-switch", file: "mode-switch-DEF456.js", bytes: 1 };
const searchBundle: IslandBundle = { name: "search", file: "search-0123ABCD.js", bytes: 1 };
const tocBundle: IslandBundle = { name: "toc", file: "toc-456DEF.js", bytes: 1 };
const pinsBundle: IslandBundle = { name: "pins", file: "pins-789ABC.js", bytes: 1 };
const panelsBundle: IslandBundle = { name: "panels", file: "panels-789ABC.js", bytes: 1 };

function options(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    theme: defaultTheme,
    locale: "en",
    title: "Keyword page",
    stylesheets: ["../assets/site.css"],
    islands: [bundle, modeBundle, searchBundle, tocBundle, pinsBundle, panelsBundle],
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
    expect(html).toContain("<title>Keyword page</title>");
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

  /** An entity nobody cites: its panel carries no island. */
  const uncited = { ...entityPage, mentions: { mentions: [], initial: 20 } };

  it("loads no bundle but the mode switch, the search field, the pins and the panels of the header, and the table of contents, for a page without another island", () => {
    const html = renderPage("EntityPage", uncited, options());
    expect(html).not.toContain("mentions-panel-ABC123.js");
    expect(count(html, "<concordance-island")).toBe(5);
    expect(count(html, "<script defer")).toBe(5);
    expect(html).toContain('<script defer src="../assets/mode-switch-DEF456.js"></script>');
    expect(html).toContain('<script defer src="../assets/search-0123ABCD.js"></script>');
    expect(html).toContain('<script defer src="../assets/toc-456DEF.js"></script>');
    expect(html).toContain('<script defer src="../assets/pins-789ABC.js"></script>');
    expect(html).toContain('<script defer src="../assets/panels-789ABC.js"></script>');
  });

  it("loads the bundle of every island with a deferred classic script tag, never as a module nor preloaded, so that a file:// page runs it in every browser", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(25), initial: 20 } };
    const html = renderPage("EntityPage", page, options());
    expect(html).toContain('<script defer src="../assets/mentions-panel-ABC123.js"></script>');
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain("modulepreload");
    expect(count(html, "<script defer")).toBe(6);
  });

  it("loads a bundle declared as a module with a preloaded module script tag, the others staying classic", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(25), initial: 20 } };
    const html = renderPage(
      "EntityPage",
      page,
      options({
        islands: [
          { ...bundle, module: true },
          modeBundle,
          searchBundle,
          tocBundle,
          pinsBundle,
          panelsBundle,
        ],
      }),
    );
    expect(html).toContain('<link rel="modulepreload" href="../assets/mentions-panel-ABC123.js"');
    expect(html).toContain(
      '<script type="module" defer src="../assets/mentions-panel-ABC123.js"></script>',
    );
    expect(count(html, '<script type="module"')).toBe(1);
    expect(count(html, "modulepreload")).toBe(1);
    expect(count(html, "<script defer")).toBe(5);
    expect(html).not.toContain('<script defer src="../assets/mentions-panel-ABC123.js">');
  });

  it("emits no script tag at all when a theme's header carries no island and the page has no table of contents", () => {
    const Header = () => h("header", { class: "plain" }, "plain");
    const theme: ResolvedTheme = {
      components: { ...defaultComponents, Header },
      overrides: [{ slot: "Header", plugin: "@example/plain", theme: "plain" }],
    };
    const html = renderPage("EntityPage", { ...uncited, sections: [] }, options({ theme }));
    expect(html).not.toContain("<script defer");
    expect(html).not.toContain('<script type="module"');
    expect(html).not.toContain("modulepreload");
    expect(html).not.toContain("<concordance-island");
    expect(count(html, "<script>")).toBe(2);
  });

  it("writes the mode script then the panels script inline in the head, before the stylesheets, and no other inline script", () => {
    const html = renderPage("EntityPage", entityPage, options());
    expect(count(html, "<script>")).toBe(2);
    expect(html).toContain(`<script>${MODE_SCRIPT}</script><script>${PANELS_SCRIPT}</script>`);
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf('<link rel="stylesheet"'));
  });

  it("forces a scheme on the root as data-mode, to preview a palette, and then writes no inline script that would apply a remembered choice, keeping the one of the panels", () => {
    expect(renderPage("Todo", todo, options())).toContain('<html lang="en" dir="ltr"><head>');
    const dark = renderPage("Todo", todo, options({ scheme: "dark" }));
    expect(dark).toContain('<html lang="en" dir="ltr" data-mode="dark"><head>');
    expect(count(dark, "<script>")).toBe(1);
    expect(dark).not.toContain(MODE_SCRIPT);
    expect(dark).toContain(`<script>${PANELS_SCRIPT}</script>`);
    expect(dark).toContain('<script defer src="../assets/mode-switch-DEF456.js"></script>');
    expect(renderPage("Todo", todo, options({ scheme: "light" }))).toContain(
      '<html lang="en" dir="ltr" data-mode="light"><head>',
    );
  });

  it("links the favicon when one is given, and none otherwise", () => {
    expect(renderPage("Todo", todo, options())).not.toContain('rel="icon"');
    expect(renderPage("Todo", todo, options({ favicon: "../assets/favicon.svg" }))).toContain(
      '<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml"/>',
    );
  });

  it("defers the bundle of every island the page uses, once each", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(25), initial: 20 } };
    const html = renderPage("EntityPage", page, options());
    expect(count(html, "mentions-panel-ABC123.js")).toBe(1);
    expect(count(html, "<script defer")).toBe(6);
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

  it("fails when a theme's shell writes its children twice or not at all, the content being rendered once and placed where the shell puts it", () => {
    const twice = ({ children }: ShellProps) => h("html", {}, h("body", {}, children, children));
    const never = () => h("html", {}, h("body", {}, "nothing"));
    for (const Shell of [twice, never]) {
      const theme: ResolvedTheme = {
        components: { ...defaultComponents, Shell },
        overrides: [{ slot: "Shell", plugin: "@example/odd", theme: "odd" }],
      };
      expect(() => renderPage("EntityPage", entityPage, options({ theme }))).toThrow(
        "renderDocument: the shell must write its children exactly once",
      );
    }
  });

  it("fails when a page uses an island that was not bundled", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(21), initial: 20 } };
    expect(() =>
      renderPage(
        "EntityPage",
        page,
        options({ islands: [modeBundle, searchBundle, tocBundle, pinsBundle, panelsBundle] }),
      ),
    ).toThrow("renderPage: island mentions-panel has no bundle");
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
    expect(html).not.toContain('</script><script>alert("x")');
    expect(html).toContain("&lt;/script>&lt;script>alert(&quot;x&quot;)&lt;/script>");
    expect(count(html, "<script defer")).toBe(6);
  });

  it("writes dir=rtl for a right-to-left locale, whatever its region or case, and ltr otherwise", () => {
    expect(renderPage("Home", home, options({ locale: "ar" }))).toContain(
      '<html lang="ar" dir="rtl">',
    );
    expect(renderPage("Home", home, options({ locale: "HE-IL" }))).toContain(
      '<html lang="HE-IL" dir="rtl">',
    );
    expect(renderPage("Home", home, options({ locale: "fa" }))).toContain(
      '<html lang="fa" dir="rtl">',
    );
    expect(renderPage("Home", home, options({ locale: "ur" }))).toContain(
      '<html lang="ur" dir="rtl">',
    );
    expect(renderPage("Home", home, options({ locale: "fr-CA" }))).toContain(
      '<html lang="fr-CA" dir="ltr">',
    );
  });

  it("follows the script of the locale: Pashto and Sorani are written right to left, romanised Arabic is not", () => {
    expect(renderPage("Home", home, options({ locale: "ps" }))).toContain(
      '<html lang="ps" dir="rtl">',
    );
    expect(renderPage("Home", home, options({ locale: "ckb" }))).toContain(
      '<html lang="ckb" dir="rtl">',
    );
    expect(renderPage("Home", home, options({ locale: "ar-Latn" }))).toContain(
      '<html lang="ar-Latn" dir="ltr">',
    );
  });

  it("gives the same bytes for the same page twice", () => {
    const page = { ...entityPage, mentions: { mentions: mentions(25), initial: 20 } };
    expect(renderPage("EntityPage", page, options())).toBe(
      renderPage("EntityPage", page, options()),
    );
  });
});

describe("renderSlot", () => {
  it("renders one slot inside the theme, without the shell", () => {
    const html = renderSlot("Footer", footer, defaultTheme);
    expect(html.startsWith('<footer class="site-footer">')).toBe(true);
    expect(html).not.toContain("<html");
  });
});
