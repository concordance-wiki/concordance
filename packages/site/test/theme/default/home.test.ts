import { describe, expect, it } from "vitest";

import { corporateHome, home } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { defaultHomeLabels } from "../../../src/theme/default/home.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Home", () => {
  it("heads the page with the question and its explanation, the site title staying in the top bar", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<section class="home-ask" aria-labelledby="home-question"><h1 id="home-question">What are you looking for?</h1><p class="home-explanation">Type a word of the business. If it is used anywhere in the documentation, it has a page — even if nobody has defined it yet.</p>',
    );
    expect(count(html, "<h1")).toBe(1);
    expect(html).not.toContain("home-stats");
    expectBalanced(html);
  });

  it("serves the field as a search island whose form submits to the results page without any script, the counter and the panel of the live results empty", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<concordance-island data-island="search" data-props="{&quot;search&quot;:{&quot;action&quot;:&quot;search/&quot;,&quot;placeholder&quot;:&quot;Search a word of your business&quot;},&quot;home&quot;:true}">',
    );
    expect(html).toContain(
      '<form class="home-search" role="search" aria-label="Search" action="search/" method="get"><label class="visually-hidden" for="home-search">Search</label><span class="home-search-field"><svg class="search-glyph" width="20" height="20"',
    );
    expect(html).toContain(
      '<input id="home-search" type="search" name="q" placeholder="Search a word of your business" autocomplete="off"/><span class="search-count" aria-live="polite"></span></span></form><div class="search-suggestions home-suggestions" hidden></div></concordance-island>',
    );
    const withRoot = renderSlot(
      "Home",
      {
        ...home,
        search: { action: "search/", placeholder: "Search", label: "Chercher", root: "" },
      },
      defaultTheme,
    );
    expect(withRoot).toContain("&quot;root&quot;:&quot;&quot;");
    expect(withRoot).toContain('aria-label="Chercher"');
    expect(withRoot).toContain('for="home-search">Chercher</label>');
    const { search, ...rest } = home;
    expect(search).toBeDefined();
    expect(renderSlot("Home", rest, defaultTheme)).not.toContain("concordance-island");
  });

  it("offers the most cited pages as chips led by the most cited lead, and nothing when there is none", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<nav class="home-most-cited" aria-label="Most cited"><span class="home-most-cited-lead">Most cited</span><ul class="home-shortcuts"><li><a class="chip" href="glossary/entity/">entity</a></li><li><a class="chip" href="glossary/source/">source</a></li></ul></nav>',
    );
    expect(renderSlot("Home", { ...home, shortcuts: [] }, defaultTheme)).not.toContain(
      "home-most-cited",
    );
  });

  it("lists the spaces under the heading the top bar links to, one row each with the initials, the name, the count and the freshness, the tree of the space folded behind the row", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<section class="home-spaces" aria-labelledby="home-tree"><h2 id="home-tree">Spaces <span class="home-lead">fed by your repositories</span></h2><ul class="home-space-list">',
    );
    expect(html).toContain(
      '<li class="home-space"><details class="home-space-fold"><summary class="home-space-row"><span class="space-initials" aria-hidden="true">GL</span><span class="home-space-text"><span class="home-space-name">glossary</span><span class="home-space-meta">2 pages · <time datetime="2024-04-30">yesterday</time></span></span></summary><ul class="space-nodes"><li class="space-page"><a href="glossary/keyword-page/">Keyword page</a></li><li class="space-page"><a href="glossary/source/">Source</a></li></ul></details></li>',
    );
    // A count the page did not word is worded by the theme, a change it did not word shows its date.
    expect(html).toContain(
      '<span class="home-space-name">specs</span><span class="home-space-meta">1 pages · <time datetime="2024-04-20">11 days ago</time></span>',
    );
    expect(html).toContain(
      '<li class="home-space stale"><details class="home-space-fold"><summary class="home-space-row"><span class="space-initials" aria-hidden="true">RU</span><span class="home-space-text"><span class="home-space-name">rules</span><span class="home-space-meta">1 pages · <time datetime="2023-01-01">2023-01-01</time></span>',
    );
    // A space without a dated note shows its count alone, its tree empty.
    expect(html).toContain(
      '<span class="home-space-name">framing</span><span class="home-space-meta">0 pages</span></span></summary><ul class="space-nodes"></ul></details></li></ul>',
    );
    expect(html).toContain(
      '<li class="space-folder space-open"><span class="space-folder-name">screens<span class="count">1</span></span><ul class="space-nodes"><li class="space-page"><a href="specs/screens/home-page/">Home page</a></li></ul></li>',
    );
    expect(html).not.toContain("home-more-spaces");
    expect(html).toContain(
      '<p class="home-note">The dates come from the history of the repositories, so they are always right.</p></section>',
    );
  });

  it("folds the spaces beyond the first ones behind a line counting them, worded by the theme when the page does not", () => {
    const html = renderSlot("Home", corporateHome, defaultTheme);
    expect(count(html, '<li class="home-space')).toBe(7);
    expect(html).toContain(
      '</ul><details class="home-more-spaces"><summary>2 more spaces, less cited</summary><ul class="home-space-list"><li class="home-space"><details class="home-space-fold"><summary class="home-space-row"><span class="space-initials" aria-hidden="true">BR</span>',
    );
    expect(html).toContain("12 documents · <time");
    const { labels, ...unlabelled } = corporateHome;
    expect(labels).toBeDefined();
    expect(renderSlot("Home", unlabelled, defaultTheme)).toContain(
      "<summary>2 more spaces, less cited</summary>",
    );
    expect(defaultHomeLabels(3).moreSpaces).toBe("3 more spaces, less cited");
  });

  it("lists the pages changed last with their space and their date under the heading the top bar links to, then the alert on every dormant space", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain(
      '<section class="home-recent" aria-labelledby="home-recent"><h2 id="home-recent">Recently changed</h2><ul class="home-change-list"><li class="home-change"><a href="glossary/keyword-page/"><span class="home-change-title">Keyword page</span><span class="home-change-meta">glossary · <time datetime="2024-04-30">yesterday</time></span></a></li><li class="home-change"><a href="rules/old-rule/"><span class="home-change-title">Old rule</span><span class="home-change-meta">rules · <time datetime="2023-01-01">2023-01-01</time></span></a></li></ul>',
    );
    expect(html).toContain(
      '<div class="home-alert"><h3>A space has not moved for 486 days</h3><p>rules. The alert threshold is set to 180 days in the configuration.</p></div></section>',
    );
    const quiet = renderSlot("Home", { ...home, alerts: [], recent: [] }, defaultTheme);
    expect(quiet).not.toContain("home-alert");
    expect(quiet).toContain('<ul class="home-change-list"></ul></section>');
  });

  it("takes its strings from the page when it gives them", () => {
    const html = renderSlot(
      "Home",
      {
        ...home,
        labels: {
          question: "Que cherchez-vous ?",
          explanation: "Tapez un mot du métier.",
          mostCited: "Les plus citées",
          spaces: "Espaces",
          spacesLead: "alimentés par vos dépôts",
          moreSpaces: "aucun",
          datesNote: "Les dates viennent des dépôts.",
          recent: "Modifié récemment",
        },
      },
      defaultTheme,
    );
    expect(html).toContain('<h1 id="home-question">Que cherchez-vous ?</h1>');
    expect(html).toContain('<p class="home-explanation">Tapez un mot du métier.</p>');
    expect(html).toContain('aria-label="Les plus citées"');
    expect(html).toContain(
      '<h2 id="home-tree">Espaces <span class="home-lead">alimentés par vos dépôts</span></h2>',
    );
    expect(html).toContain('<p class="home-note">Les dates viennent des dépôts.</p>');
    expect(html).toContain('<h2 id="home-recent">Modifié récemment</h2>');
  });

  it("keeps the letters and the to-do link out of the page, and shows no dashboard: no canvas, no drawing but the glyph of the field, no percentage", () => {
    const html = renderSlot("Home", corporateHome, defaultTheme);
    expect(html).not.toContain("home-todo");
    expect(html).not.toContain("home-index");
    expect(html).not.toContain("<canvas");
    expect(count(html, "<svg")).toBe(1);
    expect(html).toContain('<svg class="search-glyph"');
    expect(html).not.toMatch(/\d\s?%/);
  });
});
