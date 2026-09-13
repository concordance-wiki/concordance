import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPagePhoneState: GalleryPage = {
  file: "entity-page-phone.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "phone",
  description:
    "the corporate page as a phone shows it under 700 px: the bar reduced to the menu button, the mark and the name; the breadcrumb cut to the last folder and the page; the type and the short date under the title; the note; then the blocks of the panel as folded sections with their counts, the related pages open, the neighbourhood behind its line; targets of 48 px",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateEntityPage,
};
