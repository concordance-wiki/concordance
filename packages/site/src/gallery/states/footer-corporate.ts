import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateSpaces } from "../fixtures/spaces.js";

export const footerCorporateState: GalleryPage = {
  file: "footer-corporate.html",
  slot: "Footer",
  rendered: "Spaces",
  state: "corporate",
  description:
    "the footer in the corporate chrome, below the spaces page: what the tool knows, the build instant and the repositories linked to the spaces and about pages, the generator and its licence; what the organisation declared, the legal notice, the accessibility statement with its declared state and the personal data page; the build line with the to-do page and its count",
  board: "B18",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateSpaces,
};
