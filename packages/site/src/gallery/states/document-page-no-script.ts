import type { GalleryPage } from "../page.js";
import { documentPageCorporateState } from "./document-page-corporate.js";

export const documentPageNoScriptState: GalleryPage = {
  ...documentPageCorporateState,
  file: "document-page-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the document-page-corporate state without the scripts of its islands, what a reader without JavaScript gets; the views as anchors to panels, the PDF as the browser shows it behind its noscript element, the strip of pages leading to the text of each",
  board: "B15",
  scripts: false,
};
