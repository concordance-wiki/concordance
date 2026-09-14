import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPageDarkState: GalleryPage = {
  file: "entity-page-dark.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "dark",
  description:
    "the corporate entity page in the dark scheme, forced on the root whatever the viewer prefers: a second palette, not an inversion, the ground under the surfaces of the bar, the tree and the panel, the rules and the grounds carrying the hierarchy without any shadow, the accent raised to hold 4.5:1 on the dark grounds, the switch of the bar drawing the sun",
  board: "B20",
  scheme: "dark",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateEntityPage,
};
