import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { home, index, keywordPage, searchResults, todo } from "../../../src/gallery/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Home", () => {
  it("renders the title, the statistics, the search field with shortcuts and the three entry points", () => {
    const html = renderSlot("Home", home, defaultTheme);
    expect(html).toContain("<h1>My wiki</h1>");
    expect(html).toContain("7 sources, 1894 files, built on <time");
    expect(html).toContain(
      '<form class="home-search" role="search" action="search/" method="get">',
    );
    expect(html).toContain('<a class="chip" href="glossary/entity/">entity</a>');
    expect(html).toContain('<nav class="home-entries" aria-label="Entry points">');
    expect(count(html, "<h2 ")).toBe(3);
    expect(html).toContain('<h2 id="home-tree"><a href="tree/">By file tree</a></h2>');
    expect(html).toContain('<span class="count">120</span>');
    expect(html).toContain('<time datetime="2024-04-30">2024-04-30</time>');
    expect(html).toContain('<li class="home-item stale"><a href="rules/old-rule/">Old rule</a>');
    expect(html).toContain('<span class="stale-mark">dormant</span>');
    expectBalanced(html);
  });

  it("omits the search form and the shortcuts when the site has none", () => {
    const { search, ...rest } = home;
    expect(search).toBeDefined();
    const html = renderSlot("Home", { ...rest, shortcuts: [] }, defaultTheme);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("home-shortcuts");
  });
});

describe("KeywordPage", () => {
  it("renders the banner, the three counts, the passages by file, the companions and the similar forms", () => {
    const html = renderSlot("KeywordPage", keywordPage, defaultTheme);
    expect(html).toContain('<span class="badge">keyword</span>');
    expect(html).toContain("<h1>build summary</h1>");
    expect(html).toContain(
      '<p class="banner" role="note">No note defines this word yet: 7 passages recorded.</p>',
    );
    expect(html).toContain("<dt>Occurrences</dt><dd>7</dd>");
    expect(html).toContain("<dt>Files</dt><dd>3</dd>");
    expect(html).toContain("<dt>Sources</dt><dd>2</dd>");
    expect(html).toContain('<h3><a href="../build-pipeline/">processes/build-pipeline.md</a></h3>');
    expect(html).toContain(
      '<a href="../build-pipeline/#L12">line 12</a><q>the build summary is printed</q>',
    );
    expect(html).toContain(
      '<li class="companion" data-weight="5"><a href="../build-log/">build log</a></li>',
    );
    expect(html).toContain('<li class="companion" data-weight="2"><span>counts</span></li>');
    expect(html).toContain("Offered as a lead: nothing here asserts a relation.");
    expect(html).toContain('<a href="../build-summaries/">build summaries</a>');
    expectBalanced(html);
  });

  it("omits the similar forms section when there is none", () => {
    const html = renderSlot("KeywordPage", { ...keywordPage, similar: [] }, defaultTheme);
    expect(html).not.toContain('class="similar"');
  });
});

describe("SearchResults", () => {
  it("renders the summary, the facets with counts and the ordered results", () => {
    const html = renderSlot("SearchResults", searchResults, defaultTheme);
    expect(html).toContain('<p class="search-summary">2 results for <q>threshold</q></p>');
    expect(html).toContain('<nav class="facets" aria-label="Facets">');
    expect(html).toContain(
      '<a href="?q=threshold&amp;type=term">term <span class="count">1</span></a>',
    );
    expect(html).toContain('<ol class="results">');
    expect(html).toContain(
      '<span class="badge">term</span><p class="snippet">Three occurrences in two files before a word gets a page.</p>',
    );
    expect(html).toContain(
      '<a href="../meetings/threshold-review/">Keyword page threshold review</a></li>',
    );
    expectBalanced(html);
  });

  it("omits the facets navigation when there is no facet", () => {
    const html = renderSlot("SearchResults", { ...searchResults, facets: [] }, defaultTheme);
    expect(html).not.toContain("<nav");
  });
});

describe("Index", () => {
  it("renders active letters as links, the current one marked, inactive ones visibly disabled", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain('<a class="letter" href="../index/a/">A</a>');
    expect(html).toContain('<a class="letter" href="../index/b/" aria-current="page">B</a>');
    expect(html).toContain('<span class="letter inactive" aria-disabled="true">C</span>');
    expectBalanced(html);
  });

  it("marks a word without a note and shows the glyph and count of the others", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain(
      '<span class="noteless">no note</span><a href="../keywords/build-summary/">build summary</a><span class="count">7</span>',
    );
    expect(html).toContain(
      '<span class="glyph" aria-hidden="true">T</span><a href="../glossary/build-log/">build log</a>',
    );
  });
});

describe("Todo", () => {
  it("lists the documents without markdown and the words without a note, each with its count", () => {
    const html = renderSlot("Todo", todo, defaultTheme);
    expect(html).toContain("<h1>To do</h1>");
    expect(html).toContain(
      '<h2 id="todo-documents">Documents without a markdown representation <span class="count">1</span></h2>',
    );
    expect(html).toContain(
      '<a href="../framing/vision/">framing/vision.docx</a> <span class="count">3</span>',
    );
    expect(html).toContain(
      '<h2 id="todo-terms">Words without a note <span class="count">2</span></h2>',
    );
    expectBalanced(html);
  });

  it("says when a list is empty", () => {
    const html = renderSlot("Todo", { documents: [], terms: [] }, defaultTheme);
    expect(count(html, '<p class="empty">Nothing to do.</p>')).toBe(2);
  });
});
