import { chrome, type GalleryPage } from "../page.js";
import { entityPage } from "../fixtures/entity-page.js";

export const neighbourhoodState: GalleryPage = {
  file: "neighbourhood.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "default",
  description: "two neighbours, one with a type and one with a relation",
  ...chrome,
  props: entityPage.neighbours,
};
