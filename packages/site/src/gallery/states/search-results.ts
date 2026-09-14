import { chrome, type GalleryPage } from "../page.js";
import { searchResults } from "../fixtures/search-results.js";

export const searchResultsState: GalleryPage = {
  file: "search-results.html",
  slot: "SearchResults",
  rendered: "SearchResults",
  state: "default",
  description:
    "three results, the first expanded with its type, its summary and its facts, the second condensed with its bare count, the third a word without a note, an active filter recalled above them, and three facets with a selected value, a disabled one and the keyword type dashed",
  board: "B3",
  ...chrome,
  props: searchResults,
};
