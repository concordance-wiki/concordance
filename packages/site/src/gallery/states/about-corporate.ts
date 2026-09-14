import { chrome, type GalleryPage } from "../page.js";
import { corporateAbout } from "../fixtures/about.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const aboutCorporateState: GalleryPage = {
  file: "about-corporate.html",
  slot: "About",
  rendered: "About",
  state: "corporate",
  description:
    "the about page in the corporate chrome: the build instant, the pages and the indexed words of the fixtures corpus, its seven repositories with the version each was read at, the dormant one dated in days and named under the table, what the site leaves out and how a page is corrected",
  board: "B19",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateAbout,
};
