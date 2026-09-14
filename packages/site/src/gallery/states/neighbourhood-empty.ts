import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { entityPage } from "../fixtures/entity-page.js";

export const neighbourhoodEmptyState: GalleryPage = {
  file: "neighbourhood-empty.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "empty",
  description: "an entity without any neighbour",
  board: "panels",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: { centre: entityPage.entity.title, neighbours: [] },
};
