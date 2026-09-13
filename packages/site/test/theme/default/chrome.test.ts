import { describe, expect, it } from "vitest";

import { MODE_SCRIPT } from "../../../src/mode.js";
import { renderSlot } from "../../../src/render.js";
import { REPOSITORY_URL } from "../../../src/theme/default/footer.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { footer, header } from "../../../src/gallery/fixtures.js";
import { expectBalanced } from "../../helpers/html.js";

describe("Shell", () => {
  it("renders the head assets in order: stylesheets, module preloads, then deferred module scripts", () => {
    const html = renderSlot(
      "Shell",
      {
        locale: "fr",
        direction: "ltr",
        title: "Accueil",
        head: { stylesheets: ["a.css"], modulePreloads: ["x.js"], scripts: ["x.js"] },
        children: "body",
      },
      defaultTheme,
    );
    expect(html).toContain('<html lang="fr" dir="ltr">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(html.indexOf('rel="stylesheet"')).toBeLessThan(html.indexOf('rel="modulepreload"'));
    expect(html.indexOf('rel="modulepreload"')).toBeLessThan(html.indexOf("<script"));
    expect(html).toContain("<body>");
    expect(html).toContain("body</body>");
    expect(html).not.toContain('rel="icon"');
    expect(html).not.toContain("<script>");
    expectBalanced(html);
  });

  it("writes the inline scripts before the stylesheets and the favicon with its type", () => {
    const html = renderSlot(
      "Shell",
      {
        locale: "en",
        direction: "ltr",
        title: "Home",
        head: {
          inlineScripts: [MODE_SCRIPT],
          stylesheets: ["a.css"],
          modulePreloads: [],
          scripts: [],
          favicon: "../assets/favicon.svg",
        },
        children: "body",
      },
      defaultTheme,
    );
    expect(html).toContain(`<script>${MODE_SCRIPT}</script>`);
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf('rel="stylesheet"'));
    expect(html).toContain('<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml"/>');
    expectBalanced(html);
  });

  it("leaves the type of a favicon out when its extension is unknown", () => {
    const html = renderSlot(
      "Shell",
      {
        locale: "en",
        direction: "ltr",
        title: "Home",
        head: { stylesheets: [], modulePreloads: [], scripts: [], favicon: "icon.PNG" },
        children: "body",
      },
      defaultTheme,
    );
    expect(html).toContain('<link rel="icon" href="icon.PNG" type="image/png"/>');
    const odd = renderSlot(
      "Shell",
      {
        locale: "en",
        direction: "ltr",
        title: "Home",
        head: { stylesheets: [], modulePreloads: [], scripts: [], favicon: "icon.webp" },
        children: "body",
      },
      defaultTheme,
    );
    expect(odd).toContain('<link rel="icon" href="icon.webp"/>');
  });
});

describe("Header", () => {
  it("renders the site title as a link home, the search field with its shortcut, the three links and the mode switch, no statistic", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain('<nav class="site-nav" aria-label="Site">');
    expect(html).toContain('<a class="site-title" href="../">My wiki</a>');
    expect(html).toContain(
      '<form class="site-search" role="search" aria-label="Site search" action="../search/" method="get">',
    );
    expect(html).toContain('<label class="visually-hidden" for="site-search">Search</label>');
    expect(html).toContain(
      '<span class="site-search-field"><svg class="search-glyph" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" focusable="false">',
    );
    expect(html).toContain(
      '<input id="site-search" type="search" name="q" placeholder="Search the documentation" autocomplete="off"/><button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Clear the search</span></button><kbd class="search-shortcut" aria-hidden="true">/</kbd></span>',
    );
    expect(html).toContain(
      '<ul class="site-links"><li><a href="../spaces/">Spaces</a></li><li><a href="../index/">A–Z index</a></li><li><a href="../#home-recent">Recent</a></li></ul>',
    );
    expect(html).not.toContain('class="count"');
    expect(html).toContain('<concordance-island data-island="mode-switch"');
    expectBalanced(html);
  });

  it("renders a navigation item with its count when the site gives one", () => {
    const html = renderSlot(
      "Header",
      { ...header, navigation: [{ label: "Pending", href: "../pending/", count: 3 }] },
      defaultTheme,
    );
    expect(html).toContain('<a href="../pending/">Pending<span class="count">3</span></a>');
  });

  it("inlines an SVG logo hidden from assistive technology, the title next to it being the name", () => {
    const html = renderSlot(
      "Header",
      {
        siteTitle: "Pipeline notes",
        homeHref: "../",
        navigation: [],
        logo: { svg: '<svg viewBox="0 0 1 1"><path fill="currentColor" d="M0 0h1v1z"/></svg>' },
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<a class="site-title" href="../"><span class="site-logo" aria-hidden="true"><svg viewBox="0 0 1 1"><path fill="currentColor" d="M0 0h1v1z"/></svg></span>Pipeline notes</a>',
    );
  });

  it("shows the logo before the title and omits the search form when the site has none", () => {
    const html = renderSlot(
      "Header",
      {
        siteTitle: header.siteTitle,
        homeHref: header.homeHref,
        navigation: header.navigation,
        logo: { src: "../assets/mark.svg", alt: "" },
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<a class="site-title" href="../"><img class="site-logo" src="../assets/mark.svg" alt/>My wiki</a>',
    );
    expect(html).not.toContain("<form");
  });
});

describe("Footer", () => {
  it("renders the version, the build instant as a time element, the links and the discreet credit as a link to the repository", () => {
    const html = renderSlot("Footer", footer, defaultTheme);
    expect(html).toContain("version 0.1.0, built on ");
    expect(html).toContain(
      '<time datetime="2024-05-01T10:00:00.000Z">2024-05-01T10:00:00.000Z</time>',
    );
    expect(html).toContain(
      '<ul class="site-footer-links"><li><a href="https://forge.example/wiki">Forge</a></li><li class="site-footer-todo"><a href="../todo/">To do<span class="count">12</span></a></li></ul>',
    );
    expect(html).toContain(
      `<p class="site-footer-credit"><a href="${REPOSITORY_URL}">Built with Concordance</a></p>`,
    );
    expectBalanced(html);
  });

  it("carries the to-do link with its count without any project link, and neither without a to-do page", () => {
    const { todo, ...bare } = footer;
    if (todo === undefined) throw new Error("the fixture footer carries the to-do link");
    const alone = renderSlot("Footer", { ...bare, links: [], todo }, defaultTheme);
    expect(alone).toContain(
      '<ul class="site-footer-links"><li class="site-footer-todo"><a href="../todo/">To do<span class="count">12</span></a></li></ul>',
    );
    expect(
      renderSlot(
        "Footer",
        { ...bare, links: [], todo: { label: "To do", href: "../todo/" } },
        defaultTheme,
      ),
    ).toContain('<li class="site-footer-todo"><a href="../todo/">To do</a></li>');
    expect(renderSlot("Footer", { ...bare, links: [] }, defaultTheme)).not.toContain("<ul");
  });

  it("imposes no mention of the tool and renders the project text when given", () => {
    const { todo, ...bare } = footer;
    expect(todo).toBeDefined();
    const html = renderSlot(
      "Footer",
      { ...bare, links: [], credit: false, text: "Internal use only" },
      defaultTheme,
    );
    expect(html).not.toContain("Concordance");
    expect(html).not.toContain("<ul");
    expect(html).toContain('<p class="site-footer-text">Internal use only</p>');
  });
});
