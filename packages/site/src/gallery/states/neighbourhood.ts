import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { entityPage } from "../fixtures/entity-page.js";

export const neighbourhoodState: GalleryPage = {
  file: "neighbourhood.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "default",
  description: "two neighbours, one with a type and one with a relation",
  board: "panels",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: entityPage.neighbours,
};
