import { chrome, type GalleryPage } from "../page.js";
import { corporateDrawerHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";

export const entityPageDrawerState: GalleryPage = {
  file: "entity-page-drawer.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "drawer",
  description:
    "the same page with the drawer served open, as the menu button opens it under 1100 px: the bar with ✕ and the name, the search field first, the spaces with their initials and counts, the tree of the space unfolded to the page, the index and the recent changes at the foot, the mode switch after them; a disclosure, so that it works without any script and over file://",
  board: "B9",
  width: 390,
  ...chrome,
  header: corporateDrawerHeader,
  footer: corporateFooter,
  props: corporateEntityPage,
};
