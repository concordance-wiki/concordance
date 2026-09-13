import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { ResultList } from "../../../src/theme/default/result-list.js";
import { SearchIsland } from "../../../src/theme/default/search-island.js";
import {
  defaultSuggestionLabels,
  SearchSuggestions,
  suggestionDetail,
} from "../../../src/theme/default/search-suggestions.js";
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
      '<input id="site-search" type="search" name="q" placeholder="Search entities and keywords…" autocomplete="off"/><button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Clear the search</span></button>',
    );
    expect(html).toContain('<div class="search-suggestions" hidden></div></concordance-island>');
    expectBalanced(html);
  });

  it("names the clear button from the catalogue when the field carries the label", () => {
    const html = renderSlot(
      "Header",
      {
        ...header,
        search: {
          ...header.search,
          action: "../search/",
          placeholder: "",
          clearLabel: "Effacer la recherche",
        },
      },
      defaultTheme,
    );
    expect(html).toContain(
      '<button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Effacer la recherche</span></button>',
    );
  });

  it("carries no root when the site has no index, the field then only submitting the form", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      '<concordance-island data-island="search" data-props="{&quot;search&quot;:{&quot;action&quot;:&quot;../search/&quot;,&quot;placeholder&quot;:&quot;Search the documentation&quot;}}">',
    );
    expect(html).toContain('<label class="visually-hidden" for="site-search">Search</label>');
  });
});

describe("the search island at the head of the home page", () => {
  it("draws the large form with its counter and the panel of the live results in the flow, the labels the field carries travelling with the island", () => {
    const html = renderSlot(
      "Todo",
      { documents: [], terms: [] },
      {
        components: {
          ...defaultComponents,
          Todo: () =>
            h(SearchIsland, {
              root: "",
              home: true,
              search: {
                action: "search/index.html",
                placeholder: "Search the documentation",
                label: "Search",
                root: "",
                suggestions: defaultSuggestionLabels,
              },
            }),
        },
        overrides: [],
      },
    );
    expect(html).toContain("&quot;home&quot;:true");
    expect(html).toContain(
      "&quot;suggestions&quot;:{&quot;matches&quot;:{&quot;one&quot;:&quot;# match&quot;",
    );
    expect(html).toContain(
      '<form class="home-search" role="search" aria-label="Search" action="search/index.html" method="get"><label class="visually-hidden" for="home-search">Search</label><span class="home-search-field"><svg class="search-glyph" width="20" height="20"',
    );
    expect(html).toContain(
      '<span class="search-count" aria-live="polite"></span><button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Clear the search</span></button></span></form><div class="search-suggestions home-suggestions" hidden></div></concordance-island>',
    );
    expect(html).not.toContain("site-search");
    expectBalanced(html);
  });
});

describe("SearchSuggestions", () => {
  it("draws one link per row with the marked title, the detail line and the space, then the keyboard help and the link to the whole list", () => {
    const html = renderToString(
      h(SearchSuggestions, {
        query: "thresh",
        suggestions: [
          {
            title: "Publication threshold",
            href: "specs/rules/publication-threshold/",
            typeLabel: "Business rule",
            summary: "Three occurrences in two files before a word gets a page.",
            cited: 12,
            space: "specs",
          },
          {
            title: "threshold applied",
            href: "keywords/threshold-applied/",
            keyword: true,
            documents: 1,
            space: "meetings",
          },
          { title: "Untyped", href: "notes/untyped/", cited: 0, space: "notes" },
        ],
        total: 17,
        resultsHref: "search/index.html?q=thresh",
        locale: "en",
      }),
    );
    expect(html).toBe(
      '<ol class="suggestions"><li class="suggestion"><a href="specs/rules/publication-threshold/"><span class="suggestion-title">Publication <mark>thresh</mark>old</span><span class="suggestion-detail">Business rule — Three occurrences in two files before a word gets a page.</span><span class="suggestion-space">specs</span></a></li><li class="suggestion suggestion-keyword"><a href="keywords/threshold-applied/"><span class="suggestion-title"><mark>thresh</mark>old applied</span><span class="suggestion-detail">Used in 1 document, never defined</span><span class="suggestion-space">meetings</span></a></li><li class="suggestion"><a href="notes/untyped/"><span class="suggestion-title">Untyped</span><span class="suggestion-space">notes</span></a></li></ol><p class="suggestions-help"><kbd>↑ ↓</kbd> browse <kbd>Enter</kbd> open<a class="suggestions-all" href="search/index.html?q=thresh">See the 17 results</a></p>',
    );
    const worded = renderToString(
      h(SearchSuggestions, {
        query: "",
        suggestions: [
          { title: "k", href: "k/", keyword: true, space: "specs" },
          { title: "one", href: "one/", space: "specs" },
        ],
        total: 1,
        resultsHref: "?",
        locale: "fr",
        labels: {
          usedIn: { one: "Employé dans # document", other: "Employé dans # documents" },
          seeResults: { one: "Voir le résultat", other: "Voir les # résultats" },
          enter: "Entrée",
        },
      }),
    );
    expect(worded).toContain('<span class="suggestion-detail">Employé dans 0 document</span>');
    expect(worded).toContain(
      '<kbd>↑ ↓</kbd> browse <kbd>Entrée</kbd> open<a class="suggestions-all" href="?">Voir le résultat</a>',
    );
  });

  it("words the detail line of a glossary term by its citations, of a note by its type and its first line, either alone when the other is missing", () => {
    const text = defaultSuggestionLabels;
    expect(
      suggestionDetail(
        {
          title: "Source",
          href: "glossary/source/",
          typeLabel: "Term",
          glossary: true,
          cited: 21,
          space: "glossary",
        },
        text,
        "en",
      ),
    ).toBe("Glossary term — cited in 21 pages");
    expect(
      suggestionDetail(
        { title: "Source", href: "glossary/source/", glossary: true, space: "glossary" },
        text,
        "en",
      ),
    ).toBe("Glossary term — cited in 0 pages");
    expect(
      suggestionDetail(
        {
          title: "Build",
          href: "specs/objects/build/",
          typeLabel: "Business object",
          space: "specs",
        },
        text,
        "en",
      ),
    ).toBe("Business object");
    expect(
      suggestionDetail(
        {
          title: "Build",
          href: "specs/objects/build/",
          summary: "What one run produces.",
          space: "specs",
        },
        text,
        "en",
      ),
    ).toBe("What one run produces.");
    expect(
      suggestionDetail(
        {
          title: "Build",
          href: "specs/objects/build/",
          typeLabel: "Objet métier",
          summary: "Ce qu'une exécution produit.",
          space: "specs",
        },
        { ...text, typeSummary: "{summary} ({type})" },
        "fr",
      ),
    ).toBe("Ce qu'une exécution produit. (Objet métier)");
  });

  it("tells a namesake apart by its qualifier after the title, in the label colour, outside the mark", () => {
    const html = renderToString(
      h(SearchSuggestions, {
        query: "source",
        suggestions: [
          { title: "Source", href: "glossary/source/", qualifier: "glossary", space: "glossary" },
          { title: "Source", href: "specs/objects/source/", qualifier: "specs", space: "specs" },
        ],
        total: 2,
        resultsHref: "?q=source",
        locale: "en",
      }),
    );
    expect(html).toContain(
      '<span class="suggestion-title"><mark>Source</mark><span class="suggestion-qualifier"> · glossary</span></span>',
    );
    expect(html).toContain(
      '<span class="suggestion-title"><mark>Source</mark><span class="suggestion-qualifier"> · specs</span></span>',
    );
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
      '<concordance-island data-island="search" data-props="{&quot;root&quot;:&quot;../&quot;,&quot;results&quot;:{&quot;query&quot;:&quot;&quot;,&quot;total&quot;:0,&quot;results&quot;:[],&quot;facets&quot;:[]}}"><div class="search-results"><h1 class="visually-hidden">Search</h1><div class="results-layout"><div class="results-main"><div class="results-head"><p class="search-summary" role="status">0 results for <q></q></p></div><ol class="results"></ol></div></div></div></concordance-island>',
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
  it("expands the first row with the type chip, the title as a link, the citations worded, the breadcrumb, the summary and the facts, each when given, and condenses the others with the bare count", () => {
    const html = renderToString(
      h(ResultList, {
        results: [
          {
            title: "Keyword page",
            href: "../glossary/keyword-page/index.html",
            typeLabel: "Term",
            cited: "cited in 4 pages",
            citedCount: 4,
            breadcrumb: ["Command line", "Publication"],
            snippet: "A page built for every word above the threshold.",
            facts: ["glossary", "Also called: word page", "Broader term: Page"],
          },
          {
            title: "Publication threshold",
            href: "../glossary/publication-threshold/index.html",
            typeLabel: "Term",
            cited: "cited in 38 pages",
            citedCount: 38,
            snippet: "Three occurrences in two files before a word gets a page.",
            facts: ["glossary", "Also called: threshold"],
          },
          {
            title: "build summary",
            href: "../keywords/build-summary/index.html",
            breadcrumb: [],
            facts: [],
          },
        ],
      }),
    );
    expect(html).toBe(
      '<ol class="results"><li class="result result-lead"><p class="result-head"><span class="badge">Term</span><a class="result-title" href="../glossary/keyword-page/index.html">Keyword page</a><span class="result-cited">cited in 4 pages</span></p><span class="breadcrumb">Command line / Publication</span><p class="snippet">A page built for every word above the threshold.</p><p class="result-facts"><span>glossary</span><span>Also called: word page</span><span>Broader term: Page</span></p></li><li class="result"><p class="result-head"><span class="badge">Term</span><a class="result-title" href="../glossary/publication-threshold/index.html">Publication threshold</a><span class="result-cited result-cited-count">38</span></p><p class="snippet">Three occurrences in two files before a word gets a page.</p></li><li class="result"><p class="result-head"><a class="result-title" href="../keywords/build-summary/index.html">build summary</a></p></li></ol>',
    );
  });

  it("shows no count for a page nothing cites, expanded or condensed", () => {
    const html = renderToString(
      h(ResultList, {
        results: [
          { title: "Vision", href: "../framing/vision/", citedCount: 0, facts: ["framing"] },
          { title: "Roadmap", href: "../framing/roadmap/", citedCount: 0 },
          { title: "Non-goals", href: "../framing/non-goals/" },
        ],
      }),
    );
    expect(html).toBe(
      '<ol class="results"><li class="result result-lead"><p class="result-head"><a class="result-title" href="../framing/vision/">Vision</a></p><p class="result-facts"><span>framing</span></p></li><li class="result"><p class="result-head"><a class="result-title" href="../framing/roadmap/">Roadmap</a></p></li><li class="result"><p class="result-head"><a class="result-title" href="../framing/non-goals/">Non-goals</a></p></li></ol>',
    );
  });

  it("outlines a word without a note with the result-keyword class, its notice and its documents after the title", () => {
    const html = renderToString(
      h(ResultList, {
        results: [
          {
            title: "build summary",
            href: "../keywords/build-summary/index.html",
            typeLabel: "Without a definition",
            keyword: true,
            subtitle: "Expression without a note",
            detail: "Used in 6 documents, never defined in the glossary",
          },
        ],
      }),
    );
    expect(html).toBe(
      '<ol class="results"><li class="result result-lead result-keyword"><p class="result-head"><span class="badge">Without a definition</span><a class="result-title" href="../keywords/build-summary/index.html">build summary</a></p><span class="result-subtitle">Expression without a note</span><p class="result-detail">Used in 6 documents, never defined in the glossary</p></li></ol>',
    );
  });

  it("names a facet value by its value when it has no label, a disabled one boxed but disabled", () => {
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
      '<li class="facet-value facet-disabled"><input type="checkbox" id="facet-type-screen" name="type" value="screen" disabled/><label for="facet-type-screen"><span class="facet-label">screen</span><span class="count">0</span></label></li><li class="facet-value"><input type="checkbox" id="facet-type-term" name="type" value="term"/><label for="facet-type-term"><span class="facet-label">term</span><span class="count">0</span></label></li>',
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
