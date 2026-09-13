import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { corporateSpace, corporateSpaceHeader } from "../fixtures/spaces.js";

export const spaceCorporateState: GalleryPage = {
  file: "space-corporate.html",
  slot: "Space",
  rendered: "Space",
  state: "corporate",
  description:
    "the page of the specifications space in the corporate chrome: the search field confined to the space, the breadcrumb from the spaces page, the badge, the title, the sentence of the configuration and the line counting the pages, naming the repository and dating the newest change; the categories of the repository with their counts, each opening its own list; the pages changed last and the most cited words counted in the space only, one of them without a note; no tree",
  ...chrome,
  header: corporateSpaceHeader,
  footer: corporateFooter,
  props: corporateSpace,
};
