import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPageCorporateState: GalleryPage = {
  file: "entity-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "corporate",
  description:
    "a rule of the specifications space in the corporate chrome: the top bar with the mark, the tree of the space with the current folder open and the current page ruled, the breadcrumb, the line under the title, the note, the path and the edit link, then the three blocks of the panel, properties, table of contents and related pages with their types, the neighbourhood folded behind its line",
  board: "B2",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateEntityPage,
};
