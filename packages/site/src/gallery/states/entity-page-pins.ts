import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporatePinnedHeader } from "../fixtures/pins.js";

export const entityPagePinsState: GalleryPage = {
  file: "entity-page-pins.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "pins",
  description:
    "the same page once the reader pinned five pages: the row under the bar, its label, one chip per page in the order of pinning, the current page filled, each with its cross, and the count at the end; the button after the title pressed, reading that the page is pinned; the row and the button are served here to preview them, where on the site the script of the island draws them from the storage of the browser and nothing shows until a page is pinned",
  board: "B22",
  ...chrome,
  header: corporatePinnedHeader,
  footer: corporateFooter,
  props: { ...corporateEntityPage, pinned: true },
};
