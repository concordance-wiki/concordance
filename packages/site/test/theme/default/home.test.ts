import { describe, expect, it } from "vitest";

import { home } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Home", () => {
  it("states the number of sources, files and the date of the last build under the title", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain("<h1>My wiki</h1>");
    expect(html).toContain(
      '<p class="home-stats">7 sources, 1894 files, built on <time datetime="2024-05-01T10:00:00.000Z">May 1, 2024</time></p>',
    );
    const { builtAtLabel, ...instant } = home.stats;
    expect(builtAtLabel).toBeDefined();
    const bare = renderSlot("Home", { ...home, stats: instant }, defaultTheme);

    expect(bare).toContain(
      '<time datetime="2024-05-01T10:00:00.000Z">2024-05-01T10:00:00.000Z</time>',
    );
    expectBalanced(html);
  });

  it("keeps a search region the search index fills, the most cited words as shortcuts next to it", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<div class="home-search-slot" data-slot="search"><form class="home-search" role="search" aria-label="Search" action="search/" method="get">',
    );
    expect(html).toContain('<ul class="home-shortcuts" aria-label="Most cited words">');
    expect(html).toContain('<a class="chip" href="glossary/entity/">entity</a>');
    const { search, ...rest } = home;
    expect(search).toBeDefined();
    const empty = renderSlot("Home", { ...rest, shortcuts: [] }, defaultTheme);
    expect(empty).toContain('<div class="home-search-slot" data-slot="search"></div>');
    expect(empty).not.toContain("<form");
    expect(empty).not.toContain("home-shortcuts");
  });

  it("gives the three entry points the same standing: one section each, titled, in one navigation", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain('<nav class="home-entries" aria-label="Entry points">');
    expect(count(html, '<section class="home-entry ')).toBe(3);
    expect(count(html, "<h2 ")).toBe(3);
    expect(html).toContain('<h2 id="home-tree"><a href="tree/">By file tree</a></h2>');
    expect(html).toContain('<h2 id="home-index"><a href="index/">By word</a></h2>');
    expect(html).toContain('<h2 id="home-recent"><a href="recent/">Latest changes</a></h2>');
    const unlinked = renderSlot(
      "Home",
      {
        ...home,
        entries: home.entries.map((entry) => {
          const { href, ...rest } = entry;
          expect(href).toBeDefined();
          return rest;
        }),
      },
      defaultTheme,
    );
    expect(unlinked).toContain('<h2 id="home-tree">By file tree</h2>');
  });

  it("folds the file tree in one details per source, open, folders closed under them, notes as links", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<ul class="home-tree"><li class="tree-folder"><details open><summary>glossary<span class="count">2</span></summary><ul><li class="tree-note"><a href="glossary/keyword-page/">Keyword page</a></li>',
    );
    expect(html).toContain(
      '<li class="tree-folder"><details><summary>screens<span class="count">1</span></summary><ul><li class="tree-note"><a href="specs/screens/home-page/">Home page</a></li></ul></details></li>',
    );
    expect(count(html, "<details open>")).toBe(2);
    expect(count(html, "<details>")).toBe(1);
  });

  it("lists the letters of the index with their counts and the latest changes with their dates, the dormant ones marked", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<li class="home-item"><a href="index/a/">A</a><span class="count">40</span></li>',
    );
    expect(html).toContain(
      '<a href="glossary/keyword-page/">Keyword page</a><time datetime="2024-04-30">Apr 30, 2024</time>',
    );
    expect(html).toContain(
      '<li class="home-item stale"><a href="rules/old-rule/">Old rule</a><time datetime="2023-01-01">2023-01-01</time><span class="stale-mark">dormant</span></li>',
    );
    expect(html).toContain('<ul class="home-sources" aria-label="Freshness of the sources">');
    expect(html).toContain(
      '<li class="home-source"><span class="home-source-name">glossary</span><time datetime="2024-04-30">Apr 30, 2024</time></li>',
    );
    expect(html).toContain(
      '<li class="home-source stale"><span class="home-source-name">rules</span><time datetime="2023-01-01">2023-01-01</time><span class="stale-mark">dormant</span></li>',
    );
    expect(html).toContain(
      '<li class="home-source"><span class="home-source-name">framing</span></li>',
    );
  });

  it("links the to-do page with its count and omits the line when the page has no link", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<p class="home-todo"><a href="todo/">To do<span class="count">12</span></a></p>',
    );
    const uncounted = renderSlot(
      "Home",
      { ...home, todo: { label: "To do", href: "todo/" } },
      defaultTheme,
    );
    expect(uncounted).toContain('<p class="home-todo"><a href="todo/">To do</a></p>');
    const { todo, ...rest } = home;
    expect(todo).toBeDefined();
    expect(renderSlot("Home", rest, defaultTheme)).not.toContain("home-todo");
  });

  it("shows no dashboard: no canvas, no drawing, no percentage", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("<svg");
    expect(html).not.toMatch(/\d\s?%/);
  });
});
