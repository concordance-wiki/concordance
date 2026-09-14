import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooterAlone } from "../fixtures/chrome.js";
import { corporateSpaces } from "../fixtures/spaces.js";

export const footerAloneState: GalleryPage = {
  file: "footer-alone.html",
  slot: "Footer",
  rendered: "Spaces",
  state: "alone",
  description:
    "the footer without anything declared by the organisation: the first column alone, exact and complete, no state of accessibility shown since none was declared",
  board: "B18",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooterAlone,
  props: corporateSpaces,
};
