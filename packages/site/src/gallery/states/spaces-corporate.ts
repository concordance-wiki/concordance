import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateSpaces } from "../fixtures/spaces.js";

export const spacesCorporateState: GalleryPage = {
  file: "spaces-corporate.html",
  slot: "Spaces",
  rendered: "Spaces",
  state: "corporate",
  description:
    "the spaces page in the corporate chrome: the seven spaces of the fixtures corpus in one table, none folded, with their content, their page count and their newest change from the git history, the dormant one dated in the accent and in days, and the note on the threshold",
  board: "B11",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateSpaces,
};
