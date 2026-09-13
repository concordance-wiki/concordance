import { chrome, type GalleryPage } from "../page.js";
import { neighbourhoodOverflow } from "../fixtures/neighbourhood.js";

export const neighbourhoodOverflowState: GalleryPage = {
  file: "neighbourhood-overflow.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "overflow",
  description:
    "more neighbours in the model than the map may show: a pointer to the mentions panel replaces it, the list stays",
  ...chrome,
  props: neighbourhoodOverflow,
};
