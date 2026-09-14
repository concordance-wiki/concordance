import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { searchResultsCorporate } from "../fixtures/search-results.js";

export const searchResultsCorporateState: GalleryPage = {
  file: "search-results-corporate.html",
  slot: "SearchResults",
  rendered: "SearchResults",
  state: "corporate",
  description:
    "the results of a query in the corporate chrome: the page type and the space as open checkbox groups in the full-height column on the left with their counts and the note on the counters at its foot, the other facets folded under them, the selected space as a chip above the summary, the first note of the fixtures corpus expanded with its type chip, its citations, its whole summary and the line of its space, other names and broader term, a second note condensed on one line with its bare count, and a word without a note dotted among them, its chip reading Without a definition, the note on such words under the list",
  board: "B3",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: searchResultsCorporate,
};
