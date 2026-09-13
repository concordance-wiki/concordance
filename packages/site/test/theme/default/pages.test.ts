import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { searchResults, searchResultsEmpty } from "../../../src/gallery/fixtures.js";
import { expectBalanced } from "../../helpers/html.js";

describe("SearchResults", () => {
  it("renders the facets as boxes in their column with the note on the counters, the active filters as chips, the summary, the address and the rows", () => {
    const html = renderSlot("SearchResults", searchResults, defaultTheme);
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
    expect(html).toContain(
      '<p class="search-address"><span class="visually-hidden">Address of this search</span><code class="search-url">search/index.html?q=threshold&amp;source=glossary</code></p>',
    );
    expect(html).not.toContain("copy-address");
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
      '<li class="result"><p class="result-head"><span class="badge">term</span><a class="result-title" href="../glossary/publication-threshold/">Publication threshold</a><span class="result-cited">cited in 12 pages</span></p><p class="snippet">Three occurrences in two files before a word gets a page.</p><p class="result-facts"><span>glossary</span><span>Also called: threshold</span></p></li>',
    );
    expect(html).toContain(
      '<li class="result result-keyword"><p class="result-head"><span class="badge">Keyword</span><a class="result-title" href="../keywords/threshold-review/">threshold review</a></p><p class="result-detail">Used in 2 documents, never defined in the glossary</p></li>',
    );
    expect(html).toContain(
      '</ol><p class="results-note">Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.</p>',
    );
    expectBalanced(html);
  });

  it("names the query in the empty state and proposes the closest form of the dictionary, without the note under the list", () => {
    const html = renderSlot("SearchResults", searchResultsEmpty, defaultTheme);
    expect(html).toContain('<p class="search-summary" role="status">No result for “thresold”</p>');
    expect(html).toContain(
      '<p class="search-closest">Closest form: <a href="?q=threshold">threshold</a>, cited in 12 pages</p><ol class="results"></ol></div>',
    );
    expect(html).not.toContain("results-note");
    expectBalanced(html);
  });

  it("omits the facets navigation when there is no facet", () => {
    const html = renderSlot("SearchResults", { ...searchResults, facets: [] }, defaultTheme);
    expect(html).not.toContain("<nav");
  });
});
