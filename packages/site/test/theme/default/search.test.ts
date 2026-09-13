import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { ResultList } from "../../../src/theme/default/result-list.js";
import { SearchIsland } from "../../../src/theme/default/search-island.js";
import { defaultComponents } from "../../../src/theme/default/index.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../../src/theme/types.js";
import type { SearchResultsProps } from "../../../src/slots.js";
import { header } from "../../../src/gallery/fixtures.js";
import { expectBalanced } from "../../helpers/html.js";

describe("the search island in the header", () => {
  it("wraps the search form in the island with its props, the field labelled from the catalogue when a label is given, and an empty hidden panel for the suggestions", () => {
    const html = renderSlot(
      "Header",
      {
        ...header,
        search: {
          action: "../search/index.html",
          placeholder: "Search entities and keywords…",
          label: "Rechercher",
          root: "../",
        },
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<concordance-island data-island="search" data-props="{&quot;root&quot;:&quot;../&quot;,&quot;search&quot;:{&quot;action&quot;:&quot;../search/index.html&quot;,&quot;placeholder&quot;:&quot;Search entities and keywords…&quot;,&quot;label&quot;:&quot;Rechercher&quot;,&quot;root&quot;:&quot;../&quot;}}">',
    );
    expect(html).toContain(
      '<form class="site-search" role="search" aria-label="Site search" action="../search/index.html" method="get">',
    );
    expect(html).toContain('<label class="visually-hidden" for="site-search">Rechercher</label>');
    expect(html).toContain(
      '<input id="site-search" type="search" name="q" placeholder="Search entities and keywords…" autocomplete="off"/>',
    );
    expect(html).toContain('<div class="search-suggestions" hidden></div></concordance-island>');
    expectBalanced(html);
  });

  it("carries no root when the site has no index, the field then only submitting the form", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      '<concordance-island data-island="search" data-props="{&quot;search&quot;:{&quot;action&quot;:&quot;../search/&quot;,&quot;placeholder&quot;:&quot;Search a word of your business&quot;}}">',
    );
    expect(html).toContain('<label class="visually-hidden" for="site-search">Search</label>');
  });
});

const empty: SearchResultsProps = { query: "", total: 0, results: [], facets: [] };

describe("the search island on the results page", () => {
  it("renders the results slot of the current theme inside the island, so that an overriding theme serves the empty page", () => {
    const html = renderSlot(
      "Todo",
      { documents: [], terms: [] },
      {
        components: {
          ...defaultComponents,
          Todo: () => h(SearchIsland, { root: "../", results: empty }),
        },
        overrides: [],
      },
    );
    expect(html).toBe(
      '<concordance-island data-island="search" data-props="{&quot;root&quot;:&quot;../&quot;,&quot;results&quot;:{&quot;query&quot;:&quot;&quot;,&quot;total&quot;:0,&quot;results&quot;:[],&quot;facets&quot;:[]}}"><div class="search-results"><h1>Search</h1><p class="search-summary">0 results for <q></q></p><ol class="results"></ol></div></concordance-island>',
    );
    const theme: ResolvedTheme = {
      components: {
        ...defaultComponents,
        SearchResults: ({ query }) => h("p", { class: "custom" }, `custom ${query}`),
        Todo: () => h(SearchIsland, { root: "", results: { ...empty, query: "q" } }),
      },
      overrides: [{ slot: "SearchResults", plugin: "@example/theme", theme: "custom" }],
    };
    expect(renderSlot("Todo", { documents: [], terms: [] }, theme)).toContain(
      '<p class="custom">custom q</p></concordance-island>',
    );
  });
});

describe("ResultList", () => {
  it("shows the title as a link, the type badge, the breadcrumb of the application and domain, and the snippet, each when given", () => {
    const html = renderToString(
      h(ResultList, {
        results: [
          {
            title: "Keyword page",
            href: "../glossary/keyword-page/index.html",
            typeLabel: "Term",
            breadcrumb: ["Command line", "Publication"],
            snippet: "A page built for every word above the threshold.",
          },
          { title: "build summary", href: "../keywords/build-summary/index.html", breadcrumb: [] },
        ],
      }),
    );
    expect(html).toBe(
      '<ol class="results"><li class="result"><a href="../glossary/keyword-page/index.html">Keyword page</a><span class="badge">Term</span><span class="breadcrumb">Command line / Publication</span><p class="snippet">A page built for every word above the threshold.</p></li><li class="result"><a href="../keywords/build-summary/index.html">build summary</a></li></ol>',
    );
  });

  it("outlines a word without a note with the result-keyword class, its notice and its counts under the title", () => {
    const html = renderToString(
      h(ResultList, {
        results: [
          {
            title: "build summary",
            href: "../keywords/build-summary/index.html",
            typeLabel: "Keyword",
            keyword: true,
            subtitle: "Expression without a note",
            detail: "17 occurrences · 6 documents",
          },
        ],
      }),
    );
    expect(html).toBe(
      '<ol class="results"><li class="result result-keyword"><a href="../keywords/build-summary/index.html">build summary</a><span class="badge">Keyword</span><span class="result-subtitle">Expression without a note</span><span class="result-detail">17 occurrences · 6 documents</span></li></ol>',
    );
  });

  it("names a disabled facet value by its value when it has no label, like an enabled one", () => {
    const html = renderSlot(
      "SearchResults",
      {
        query: "",
        total: 0,
        results: [],
        facets: [
          {
            name: "type",
            label: "Type",
            values: [
              { value: "screen", count: 0, href: "?type=screen", disabled: true },
              { value: "term", count: 0, href: "?type=term" },
            ],
          },
        ],
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<li><a class="facet-value" role="link" aria-disabled="true">screen <span class="count">0</span></a></li><li><a href="?type=term">term <span class="count">0</span></a></li>',
    );
  });

  it("is what the results slot lists", () => {
    const html = renderSlot(
      "SearchResults",
      {
        query: "threshold",
        total: 1,
        results: [
          {
            title: "Publication threshold",
            href: "../glossary/publication-threshold/",
            breadcrumb: ["Command line"],
          },
        ],
        facets: [],
      },
      defaultTheme,
    );
    expect(html).toContain('<span class="breadcrumb">Command line</span>');
  });
});
