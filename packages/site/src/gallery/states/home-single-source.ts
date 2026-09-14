import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { singleSourceHeader, singleSourceHome } from "../fixtures/degraded.js";

export const homeSingleSourceState: GalleryPage = {
  file: "home-single-source.html",
  slot: "Home",
  rendered: "Home",
  state: "single-source",
  description:
    "the home page of a corpus fed by one repository: one space in the top bar and one row under the question, its own pages among the recent changes, nothing folded, no alert",
  board: "B1",
  ...chrome,
  header: singleSourceHeader,
  footer: corporateFooter,
  props: singleSourceHome,
};
