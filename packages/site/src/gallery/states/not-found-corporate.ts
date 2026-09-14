import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter, corporateHeader } from "../fixtures/chrome.js";
import { notFoundCorporate } from "../fixtures/edge-cases.js";

export const notFoundCorporateState: GalleryPage = {
  file: "not-found-corporate.html",
  slot: "NotFound",
  rendered: "NotFound",
  state: "corporate",
  description:
    "the page served for a missing address, as the build writes it and as a reader without JavaScript gets it: the bar and the footer kept, the cause in plain words, what stays reachable, the nearby addresses hidden until the island names them, two exits, the search of the documentation and the list of the spaces",
  board: "B17",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: notFoundCorporate,
};
