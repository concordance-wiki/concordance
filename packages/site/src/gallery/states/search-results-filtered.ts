import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter, corporateHeader } from "../fixtures/chrome.js";
import { searchResultsFiltered } from "../fixtures/edge-cases.js";

export const searchResultsFilteredState: GalleryPage = {
  file: "search-results-filtered.html",
  slot: "SearchResults",
  rendered: "SearchResults",
  state: "filtered",
  description:
    "a query the selected filter empties: the word exists in the documentation, on no screen page; the notice names the filter, the sentence says where the word exists, one exit lifts the filter with the count of what comes back, the other leads to the page of the word with its citations; told apart from a word no file uses",
  board: "B17",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: searchResultsFiltered,
};
