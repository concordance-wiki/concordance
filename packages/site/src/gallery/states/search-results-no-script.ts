import type { GalleryPage } from "../page.js";
import { searchResultsCorporateState } from "./search-results-corporate.js";

export const searchResultsNoScriptState: GalleryPage = {
  ...searchResultsCorporateState,
  file: "search-results-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the search-results-corporate state without the scripts of its islands, what a reader without JavaScript gets; the field of the bar a plain form, the results as the build wrote them under the facets, no clear button",
  board: "B3",
  scripts: false,
};
