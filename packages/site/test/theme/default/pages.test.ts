import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { searchResults } from "../../../src/gallery/fixtures.js";
import { expectBalanced } from "../../helpers/html.js";

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
