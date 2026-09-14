import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter, corporateHeader } from "../fixtures/chrome.js";
import { notFoundNearby } from "../fixtures/edge-cases.js";

export const notFoundNearbyState: GalleryPage = {
  file: "not-found-nearby.html",
  slot: "NotFound",
  rendered: "NotFound",
  state: "nearby",
  description:
    "the same page once its island read the address glossary/publication-treshold: the two pages whose address stands closest by edit distance on the path, each with its title and its address, and the search worded on the last segment of the address",
  board: "B17",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: notFoundNearby,
};
