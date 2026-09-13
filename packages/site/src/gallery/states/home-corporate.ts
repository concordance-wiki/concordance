import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateHome } from "../fixtures/home.js";

export const homeCorporateState: GalleryPage = {
  file: "home-corporate.html",
  slot: "Home",
  rendered: "Home",
  state: "corporate",
  description:
    "the home page in the corporate chrome: the question and the field with its live results to come, the most cited pages as shortcuts, five spaces of the fixtures corpus with their counts and freshness and two more folded, each row leading to the page of its space, the pages changed last, the alert on a space that has not moved past the threshold",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateHome,
};
