import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { neighbourhoodOverflow } from "../fixtures/neighbourhood.js";

export const neighbourhoodOverflowState: GalleryPage = {
  file: "neighbourhood-overflow.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "overflow",
  description:
    "more neighbours in the model than the map may show: the map draws the ones listed, the total under it",
  board: "panels",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: neighbourhoodOverflow,
};
