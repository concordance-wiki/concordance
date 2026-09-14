import { chrome, type GalleryPage } from "../page.js";
import { corporateApiPage } from "../fixtures/api-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const apiPageCorporateState: GalleryPage = {
  file: "api-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "api-corporate",
  description:
    "the model query API of the fixtures corpus in the corporate chrome: the tree of the space with the operations under the current interface, the breadcrumb, the line naming the type, the change and the space, the note, then the operations table matched to the contract by operation name, in the order of the contract, the method as a chip, the path, the title of the note and the callers, with two gap rows in italics, one present in the contract without a page and one described without existing in the contract; the contract block with its format, its file and the date of its last change on one line, the viewer open in the page under it, a link to its JSON view until the script runs, and the download link at its foot; in the panel the five keys with their note, the related pages with the operations first, the neighbourhood folded",
  board: "B7",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateApiPage,
};
