import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import {
  searchResults,
  searchResultsEmpty,
  searchResultsFiltered,
} from "../../../src/gallery/fixtures.js";
import { expectBalanced } from "../../helpers/html.js";

describe("SearchResults", () => {
  it("renders the heading for assistive technology alone, the facets as boxes in their column with the note on the counters, the active filters as chips, the summary and the rows, the first expanded", () => {
    const html = renderSlot("SearchResults", searchResults, defaultTheme);
    expect(html).toContain('<div class="search-results"><h1 class="visually-hidden">Search</h1>');
    expect(html).toContain(
      '<p class="search-summary" role="status">3 results, most cited first</p>',
    );
    expect(
      renderSlot(
        "SearchResults",
        { query: "threshold", total: 2, results: [], facets: [] },
        defaultTheme,
      ),
    ).toContain('<p class="search-summary" role="status">2 results for <q>threshold</q></p>');
    expect(html).not.toContain("search-address");
    expect(html).toContain(
      '<nav class="facets" aria-label="Facets"><details class="facets-fold"><summary class="facets-head">Facets</summary><div class="facet-groups"><details class="facet" open><summary><h2>Page type</h2></summary><ul class="facet-values">',
    );
    expect(html).toContain(
      '<li class="facet-value"><input type="checkbox" id="facet-type-term" name="type" value="term"/><label for="facet-type-term"><span class="facet-label">term</span><span class="count">1</span></label></li>',
    );
    expect(html).toContain(
      '<li class="facet-value facet-disabled"><input type="checkbox" id="facet-type-screen" name="type" value="screen" disabled/>',
    );
    expect(html).toContain(
      '<li class="facet-value facet-keyword"><input type="checkbox" id="facet-type-keyword" name="type" value="keyword"/>',
    );
    expect(html).toContain(
      '<li class="facet-value facet-active"><input type="checkbox" id="facet-source-glossary" name="source" value="glossary" checked/>',
    );
    expect(html).toContain(
      '<details class="facet"><summary><h2>Without a note</h2></summary><ul class="facet-values"><li class="facet-value facet-active"><input type="radio" id="facet-nonote-any" name="nonote" value="any" checked/>',
    );
    expect(html).toContain(
      '<p class="facets-note">The counters are set when the site is published. Filtering happens in the browser, without a round trip.</p></div></details></nav>',
    );
    expect(html).toContain(
      '<ul class="active-filters" aria-label="Active filters"><li class="active-filter"><a href="?q=threshold" class="remove-filter"><span class="visually-hidden">Remove this filter Space: </span>glossary <span aria-hidden="true">✕</span></a></li><li class="clear-filters"><a href="?q=threshold">Clear filters</a></li></ul>',
    );
    expect(html).toContain(
      '<li class="result result-lead"><p class="result-head"><span class="badge">term</span><a class="result-title" href="../glossary/publication-threshold/">Publication threshold</a><span class="result-cited">cited in 12 pages</span></p><p class="snippet">Three occurrences in two files before a word gets a page.</p><p class="result-facts"><span>glossary</span><span>Also called: threshold</span></p></li>',
    );
    expect(html).toContain(
      '<li class="result"><p class="result-head"><a class="result-title" href="../meetings/threshold-review/">Keyword page threshold review</a><span class="result-cited result-cited-count">1</span></p></li>',
    );
    expect(html).toContain(
      '<li class="result result-keyword"><p class="result-head"><span class="badge">Without a definition</span><a class="result-title" href="../keywords/threshold-review/">threshold review</a></p><p class="result-detail">Used in 2 documents, never defined in the glossary</p></li>',
    );
    expect(html).toContain(
      '</ol><p class="results-note">Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.</p>',
    );
    expect(html).not.toContain("results-more");
    expectBalanced(html);
  });

  it("draws the button of the next rows under the list when the island says more remain", () => {
    const html = renderSlot(
      "SearchResults",
      { ...searchResults, more: { label: "Show the next 20", onMore: () => undefined } },
      defaultTheme,
    );
    expect(html).toContain(
      '</ol><button type="button" class="results-more">Show the next 20</button><p class="results-note">',
    );
    expectBalanced(html);
  });

  it("names the query in the empty state as one card, says no file uses the word, proposes the closest form of the dictionary and explains the prefix search, without the note under the list", () => {
    const html = renderSlot("SearchResults", searchResultsEmpty, defaultTheme);
    expect(html).toContain(
      '<div class="results-empty"><p class="results-empty-lead" role="status">No result for “thresold”</p><p class="results-empty-cause">No file uses this word.</p>',
    );
    expect(html).toContain(
      '<p class="search-closest">Closest form: <a href="?q=threshold">threshold</a>, cited in 12 pages</p><p class="results-empty-note">The search matches the start of words: a typo gives zero results and no suggestion.</p></div>',
    );
    expect(html).not.toContain("search-summary");
    expect(html).not.toContain('<ol class="results">');
    expect(html).not.toContain("results-note");
    expectBalanced(html);
  });

  it("proposes the closest form above the list when a theme gives it without an empty state", () => {
    const closestOnly = { ...searchResultsEmpty };
    delete closestOnly.empty;
    const html = renderSlot("SearchResults", closestOnly, defaultTheme);
    expect(html).toContain('<p class="search-closest">Closest form: ');
    expect(html).not.toContain("results-empty");
    expect(html).toContain('<ol class="results">');
    expectBalanced(html);
  });

  it("omits the facets navigation when there is no facet", () => {
    const html = renderSlot("SearchResults", { ...searchResults, facets: [] }, defaultTheme);
    expect(html).not.toContain("<nav");
  });

  it("draws the exits of a filtered word as rows with their counts, the page of the word dashed, and words the notice itself when the page gives none", () => {
    const html = renderSlot("SearchResults", searchResultsFiltered, defaultTheme);
    expect(html).toContain(
      '<p class="results-empty-lead" role="status">No result for “staleness” with the filter Screen.</p><p class="results-empty-cause">The word exists in the documentation, but on none of the pages the filter keeps.</p><ul class="results-exits"><li><a class="results-exit" href="?q=staleness"><span class="results-exit-label">Remove the filter “Screen”</span><span class="results-exit-count">14</span></a></li><li><a class="results-exit results-exit-secondary" href="../glossary/staleness/"><span class="results-exit-label">See the page of the word</span><span class="results-exit-count">9</span></a></li></ul></div>',
    );
    expect(html).not.toContain("results-empty-note");
    expect(html).not.toContain("search-closest");
    const unworded = { ...searchResultsFiltered };
    delete unworded.summary;
    const bare = renderSlot(
      "SearchResults",
      {
        ...unworded,
        empty: { explanation: "Nothing.", exits: [{ label: "Go", href: "?q=x" }] },
      },
      defaultTheme,
    );
    expect(bare).toContain('<p class="results-empty-lead" role="status">No result</p>');
    expect(bare).toContain(
      '<li><a class="results-exit" href="?q=x"><span class="results-exit-label">Go</span></a></li>',
    );
    expectBalanced(bare);
  });
});
