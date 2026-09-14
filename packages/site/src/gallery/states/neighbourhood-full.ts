import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { neighbourhoodFull } from "../fixtures/neighbourhood.js";

export const neighbourhoodFullState: GalleryPage = {
  file: "neighbourhood-full.html",
  slot: "Neighbourhood",
  rendered: "Neighbourhood",
  state: "full",
  description:
    "six neighbours: shapes by glyph, an initial for a glyph without a shape, a dashed noteless word, a title cut with an ellipsis",
  board: "panels",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: neighbourhoodFull,
};
