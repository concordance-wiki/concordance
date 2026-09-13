import { chrome, type GalleryPage } from "../page.js";
import { searchResultsEmpty } from "../fixtures/search-results.js";

export const searchResultsEmptyState: GalleryPage = {
  file: "search-results-empty.html",
  slot: "SearchResults",
  rendered: "SearchResults",
  state: "empty",
  description:
    "a query without any result or facet: the empty state names it and proposes the closest form of the dictionary",
  ...chrome,
  props: searchResultsEmpty,
};
