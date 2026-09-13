import { chrome, type GalleryPage } from "../page.js";
import { entityPage } from "../fixtures/entity-page.js";

export const neighbourhoodEmptyState: GalleryPage = {
  file: "neighbourhood-empty.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "empty",
  description: "an entity without any neighbour",
  ...chrome,
  props: { centre: entityPage.entity.title, neighbours: [] },
};
