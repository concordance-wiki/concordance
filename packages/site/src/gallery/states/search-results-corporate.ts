import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { searchResultsCorporate } from "../fixtures/search-results.js";

export const searchResultsCorporateState: GalleryPage = {
  file: "search-results-corporate.html",
  slot: "SearchResults",
  rendered: "SearchResults",
  state: "corporate",
  description:
    "the results of a query in the corporate chrome: the page type and the space as open checkbox groups on the left with their counts and the note on the counters, the other facets folded under them, the selected space as a chip above the summary, two notes of the fixtures corpus with their type chip, their citations, their summary and the line of their space, other names and broader term, and a word without a note dotted among them, the note on such words under the list",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: searchResultsCorporate,
};
