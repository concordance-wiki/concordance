import { describe, expect, it } from "vitest";

import { MODE_SCRIPT } from "../../../src/mode.js";
import { renderSlot } from "../../../src/render.js";
import { REPOSITORY_URL } from "../../../src/theme/default/footer.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { corporateFooter, footer, footerWithText, header } from "../../../src/gallery/fixtures.js";
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
    expect(html).toContain(
      '<a class="site-title" href="../"><span class="site-name">My wiki</span></a>',
    );
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

  it("submits the facets of a category list as hidden fields before the search field, so that the form works without any script", () => {
    const html = renderSlot(
      "Header",
      {
        ...header,
        search: {
          action: "../../search/",
          placeholder: "Search in screens",
          filters: { source: "specs", type: "screen" },
        },
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<label class="visually-hidden" for="site-search">Search</label><input type="hidden" name="source" value="specs"/><input type="hidden" name="type" value="screen"/><span class="site-search-field">',
    );
    expect(html).toContain('placeholder="Search in screens"');
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
      '<a class="site-title" href="../"><span class="site-logo" aria-hidden="true"><svg viewBox="0 0 1 1"><path fill="currentColor" d="M0 0h1v1z"/></svg></span><span class="site-name">Pipeline notes</span></a>',
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
      '<a class="site-title" href="../"><img class="site-logo" src="../assets/mark.svg" alt/><span class="site-name">My wiki</span></a>',
    );
    expect(html).not.toContain("<form");
  });
});

describe("Footer", () => {
  it("renders the two columns, what the tool knows then what the organisation declared, and the build line with the to-do link at its end", () => {
    const html = renderSlot("Footer", corporateFooter, defaultTheme);
    expect(html).toContain(
      '<footer class="site-footer"><div class="site-footer-card"><div class="site-footer-columns"><div class="site-footer-site"><h2 class="site-footer-heading">This site</h2>',
    );
    expect(html).toContain(
      '<p class="site-footer-published">Published on 13 September 2026 at 10:04, from <a href="../spaces/">7 repositories</a>. <a href="../about/">See the sources and their versions</a>.</p>',
    );
    expect(html).toContain(
      '<p class="site-footer-licence">Built with a static site generator under the GNU GPL v3 or later licence. The content belongs to its organisation.</p>',
    );
    expect(html).toContain(
      '<div class="site-footer-declared"><h2 class="site-footer-heading">Declared by the organisation</h2><ul class="site-footer-links"><li><a href="https://forge.example/legal/mentions">Legal notice</a></li><li><a href="https://forge.example/legal/accessibility">Accessibility — partially compliant</a></li><li><a href="https://forge.example/legal/privacy">Personal data</a></li></ul></div>',
    );
    expect(html).toContain(
      '<p class="site-footer-build">publication <time datetime="2026-09-13T10:04:00.000Z">Sep 13, 2026 10:04 AM</time> · profile default@1 · 134 pages · <a class="site-footer-todo" href="../todo/">To do<span class="count">12</span></a></p>',
    );
    expect(html).not.toContain("Concordance");
    expectBalanced(html);
  });

  it("shows the first column alone without anything declared, exact and complete, and words the build line itself without labels", () => {
    const html = renderSlot("Footer", footerWithText, defaultTheme);
    expect(html).toContain(
      '<div class="site-footer-declared"><h2 class="site-footer-heading">Declared by the organisation</h2><p class="site-footer-text">Documentation of the build pipeline, kept by its maintainers.</p></div>',
    );
    const { text, ...withoutText } = footerWithText;
    expect(text).toBeDefined();
    const alone = renderSlot("Footer", withoutText, defaultTheme);
    expect(alone).not.toContain("site-footer-declared");
    expect(alone).not.toContain("<ul");
    expect(alone).toContain(
      'Published on 2024-05-01T10:00:00.000Z, from <a href="../spaces/">2 repositories</a>. <a href="../about/">See the sources and their versions</a>.',
    );
    expect(alone).toContain(
      '<p class="site-footer-build">publication <time datetime="2024-05-01T10:00:00.000Z">2024-05-01T10:00:00.000Z</time> · profile default@1 · 105 pages</p>',
    );
    expect(alone).not.toContain("Concordance");
  });

  it("names the tool and links it to its repository in the sentence naming the generator only when the theme credits it", () => {
    const html = renderSlot("Footer", footer, defaultTheme);
    expect(html).toContain(
      `<p class="site-footer-licence">Built with <a class="site-footer-credit" href="${REPOSITORY_URL}">Concordance</a>, a static site generator under the GNU GPL v3 or later licence. The content belongs to its organisation.</p>`,
    );
    expect(html).toContain(
      '<ul class="site-footer-links"><li><a href="https://forge.example/wiki">Forge</a></li></ul>',
    );
    expect(html).toContain(
      '<a class="site-footer-todo" href="../todo/">To do<span class="count">12</span></a>',
    );
  });

  it("ends the sentence at the build instant without repositories, leaves the profile and the count out when unknown, and the count of the to-do link when it has none", () => {
    const { repositories, aboutHref, profile, pages, todo, ...bare } = footer;
    expect([repositories, aboutHref, profile, pages, todo].every(Boolean)).toBe(true);
    const html = renderSlot(
      "Footer",
      { ...bare, links: [], todo: { label: "To do", href: "../todo/" } },
      defaultTheme,
    );
    expect(html).toContain(
      '<p class="site-footer-published">Published on 2024-05-01T10:00:00.000Z.</p>',
    );
    expect(html).toContain(
      '<p class="site-footer-build">publication <time datetime="2024-05-01T10:00:00.000Z">2024-05-01T10:00:00.000Z</time> · <a class="site-footer-todo" href="../todo/">To do</a></p>',
    );
    expect(renderSlot("Footer", { ...bare, links: [] }, defaultTheme)).not.toContain(
      "site-footer-todo",
    );
  });
});
