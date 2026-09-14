import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateHome } from "../fixtures/home.js";

export const homeDarkState: GalleryPage = {
  file: "home-dark.html",
  slot: "Home",
  rendered: "Home",
  state: "dark",
  description:
    "the corporate home page in the dark scheme, forced on the root whatever the viewer prefers: the question and the field, the shortcuts, the rows of the spaces and the recent changes on the dark palette, the freshness alert still worded and drawn in the raised accent, the switch of the bar drawing the sun",
  board: "B20",
  scheme: "dark",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateHome,
};
