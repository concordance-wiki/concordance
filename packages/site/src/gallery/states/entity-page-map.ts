import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPageMap } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPageMapState: GalleryPage = {
  file: "entity-page-map.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "map",
  description:
    "the corporate page after a click on the line of the panel: the neighbourhood served open, the map in place of the blocks of the panel from 1100 px, the text still readable; at the head of the panel the back control, the title of the map and the name of the page; the distance the model records, the type filter as a disclosure of checkboxes served all ticked; six neighbours on the ring, every one named, a word without a note drawn dotted, the legend saying so; then the six neighbours as a list, each with its type and its passage count, and the note on why the map stops at six",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateEntityPageMap,
};
