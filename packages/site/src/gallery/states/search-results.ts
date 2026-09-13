import { chrome, type GalleryPage } from "../page.js";
import { searchResults } from "../fixtures/search-results.js";

export const searchResultsState: GalleryPage = {
  file: "search-results.html",
  slot: "SearchResults",
  rendered: "SearchResults",
  state: "default",
  description:
    "three results, one with a type, a summary and its facts, one a word without a note, the address of the search, an active filter recalled above them, and three facets with a selected value, a disabled one and the keyword type dashed",
  ...chrome,
  props: searchResults,
};
