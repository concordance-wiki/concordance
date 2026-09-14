import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPageTabletState: GalleryPage = {
  file: "entity-page-tablet.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "tablet",
  description:
    "the corporate page between 700 and 1099 px: the bar with the menu button, the name, the search button reading as a small field that unfolds the field and the mode switch; the tree in the drawer; the panel in a narrow column beside the text, condensed, the properties as values alone, the table of contents left out, the related pages as three titles and the count of the others behind a disclosure; the neighbourhood at the foot of the page",
  board: "B9",
  width: 834,
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateEntityPage,
};
