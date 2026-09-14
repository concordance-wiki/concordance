import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPagePhoneState: GalleryPage = {
  file: "entity-page-phone.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "phone",
  description:
    "the corporate page as a phone shows it under 700 px: the bar reduced to the menu button, the mark, the name and the magnifier that unfolds the search field; the breadcrumb cut to the last folder and the page; the type and the short date under the title; the note, then the name of the file and the short edit label on one line; then the blocks of the panel as folded sections with their counts, the table of contents first, the related pages open with three entries and the others behind their count, the neighbourhood map behind its line with the number of pages it draws; targets of 48 px",
  board: "B9",
  width: 390,
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateEntityPage,
};
