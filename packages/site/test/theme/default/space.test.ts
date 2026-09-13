import { describe, expect, it } from "vitest";

import { corporateSpace, corporateSpaceHeader } from "../../../src/gallery/fixtures/spaces.js";
import { renderSlot } from "../../../src/render.js";
import { defaultSpaceLabels } from "../../../src/theme/default/space.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Space", () => {
  it("opens on the breadcrumb from the spaces page, the badge, the title, the description and the line counting the pages, naming the repository and dating the newest change", () => {
    const html = renderSlot("Space", corporateSpace, defaultTheme);
    expect(html).toContain(
      '<div class="space-overview"><nav class="breadcrumbs" aria-label="You are here"><ol class="breadcrumbs-list"><li><a href="../spaces/">Spaces</a></li><li><span aria-current="page">specs</span></li></ol></nav>',
    );
    expect(html).toContain(
      '<header class="space-header"><span class="space-initials" aria-hidden="true">SP</span><div class="space-heading"><h1>specs</h1><p class="space-description">Screens, rules, objects, processes and interfaces of the tool.</p><p class="space-meta"><span>57 pages</span><span>repository <code>demo-specs</code></span><time datetime="2026-09-09">updated 4 days ago</time></p></div></header>',
    );
    expect(count(html, "<h1")).toBe(1);
    expect(html).not.toContain("space-tree");
    expect(html).not.toContain("<details");
    expectBalanced(html);
  });

  it("lists the categories of the repository, each a link to its list with its name, its sentence, its count and an arrow, under the heading counting them, and the note that no tree is here", () => {
    const html = renderSlot("Space", corporateSpace, defaultTheme);
    expect(html).toContain(
      '<section class="space-browse" aria-labelledby="space-browse"><h2 id="space-browse">Browse <span class="space-lead">9 categories, as filed in the repository</span></h2><ul class="space-categories"><li class="space-category"><a href="api/"><span class="space-category-name">api</span><span class="space-category-text"></span><span class="space-category-count">3</span><span class="space-category-arrow" aria-hidden="true">→</span></a></li>',
    );
    expect(count(html, '<li class="space-category">')).toBe(9);
    expect(html).toContain(
      '</ul><p class="space-note">Each category opens its own list. The tree on the left appears only once in a page, so that nothing has to be unfolded from the home page.</p></section>',
    );
    const described = renderSlot(
      "Space",
      {
        ...corporateSpace,
        categories: [
          { label: "screens", href: "screens/", description: "What a reader sees.", count: 11 },
        ],
      },
      defaultTheme,
    );
    expect(described).toContain(
      '<span class="space-category-name">screens</span><span class="space-category-text">What a reader sees.</span><span class="space-category-count">11</span>',
    );
  });

  it("lists the pages changed last with their category and their date, then the most cited words as chips with their counts, a word without a note dashed, and the closing sentence", () => {
    const html = renderSlot("Space", corporateSpace, defaultTheme);
    expect(html).toContain(
      '<div class="space-side"><section class="space-recent" aria-labelledby="space-recent"><h2 id="space-recent">Recently changed</h2><ul class="space-changes"><li class="space-change"><a href="rules/publication-threshold/"><span class="space-change-title">Publication threshold</span><span class="space-change-meta">rules · <time datetime="2026-09-09">4 days ago</time></span></a></li>',
    );
    expect(count(html, '<li class="space-change">')).toBe(4);
    expect(html).toContain(
      '<section class="space-words" aria-labelledby="space-words"><h2 id="space-words">The most cited words here</h2><ul class="space-word-list"><li><a class="chip" href="../glossary/inference/entity/">Entity<span class="chip-count">42</span></a></li>',
    );
    expect(html).toContain(
      '<li><a class="chip chip-keyword" href="../keywords/build-summary/">build summary<span class="chip-count">6</span></a></li></ul><p class="space-note">Counted in this space only, which gives its own vocabulary.</p></section>',
    );
    expect(html).toContain(
      '<p class="space-footer">A space reads like a small wiki within the wiki: its own search, its own vocabulary, its own news.</p></div></div></div>',
    );
  });

  it("leaves out what the page does not give: no description, a change without a category shows its date alone, no date shows no time", () => {
    const html = renderSlot(
      "Space",
      {
        name: "notes",
        initials: "NO",
        spacesHref: "../spaces/",
        repository: "notes",
        count: 1,
        categories: [],
        recent: [{ label: "Readme", href: "readme/", date: "2026-09-01" }],
        words: [],
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<div class="space-heading"><h1>notes</h1><p class="space-meta"><span>1 pages</span><span>repository <code>notes</code></span></p></div>',
    );
    expect(html).toContain(
      '<h2 id="space-browse">Browse <span class="space-lead">0 categories, as filed in the repository</span></h2><ul class="space-categories"></ul>',
    );
    expect(html).toContain(
      '<li class="space-change"><a href="readme/"><span class="space-change-title">Readme</span><span class="space-change-meta"><time datetime="2026-09-01">2026-09-01</time></span></a></li>',
    );
    expect(html).toContain('<ul class="space-word-list"></ul>');
    expect(html).not.toContain("space-description");
    const dated = renderSlot(
      "Space",
      { ...corporateSpace, labels: { spaces: "Espaces", browse: "Parcourir" } },
      defaultTheme,
    );
    expect(dated).toContain('<li><a href="../spaces/">Espaces</a></li>');
    expect(dated).toContain('<time datetime="2026-09-09">2026-09-09</time>');
    expect(dated).toContain(
      '<h2 id="space-browse">Parcourir <span class="space-lead">9 categories',
    );
    expect(defaultSpaceLabels(3, 2)).toMatchObject({
      pages: "3 pages",
      categoriesLead: "2 categories, as filed in the repository",
      recent: "Recently changed",
    });
  });

  it("stands under a bar whose search field says it keeps to the space and carries it as the source facet, without a tree in the drawer", () => {
    const html = renderSlot("Header", corporateSpaceHeader, defaultTheme);
    expect(html).toContain('<input type="hidden" name="source" value="specs"/>');
    expect(html).toContain('placeholder="Search in this space"');
    expect(html).toContain('<a class="drawer-spaces-title" href="../spaces/">Spaces</a>');
    expect(html).not.toContain('class="drawer-space"');
  });
});
