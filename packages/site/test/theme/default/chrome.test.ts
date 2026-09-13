import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
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
    expectBalanced(html);
  });
});

describe("Header", () => {
  it("renders the site title as a link home, the search form and the navigation with counts", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain('<nav class="site-nav" aria-label="Site">');
    expect(html).toContain('<a class="site-title" href="../">My wiki</a>');
    expect(html).toContain(
      '<form class="site-search" role="search" aria-label="Site search" action="../search/" method="get">',
    );
    expect(html).toContain('<label class="visually-hidden" for="site-search">Search</label>');
    expect(html).toContain('<a href="../todo/">To do<span class="count">12</span></a>');
    expect(html).toContain('<a href="../index/">Index</a>');
    expectBalanced(html);
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
  it("renders the version, the build instant as a time element, the links and the discreet mention", () => {
    const html = renderSlot("Footer", footer, defaultTheme);
    expect(html).toContain("version 0.1.0, built on ");
    expect(html).toContain(
      '<time datetime="2024-05-01T10:00:00.000Z">2024-05-01T10:00:00.000Z</time>',
    );
    expect(html).toContain('<a href="https://forge.example/wiki">Forge</a>');
    expect(html).toContain('<p class="site-footer-mention">Generated with Concordance</p>');
    expectBalanced(html);
  });

  it("imposes no mention of the tool and renders the project text when given", () => {
    const html = renderSlot(
      "Footer",
      { ...footer, links: [], mentionTool: false, text: "Internal use only" },
      defaultTheme,
    );
    expect(html).not.toContain("Generated with");
    expect(html).not.toContain("<ul");
    expect(html).toContain('<p class="site-footer-text">Internal use only</p>');
  });
});
