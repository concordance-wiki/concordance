import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { documentHeader, documentPageCorporate } from "../fixtures/document-page.js";

export const documentPageCorporateState: GalleryPage = {
  file: "document-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "document-page-corporate",
  description:
    "a deck of the framing space in the corporate chrome: the tree of the space folded by year and month, the breadcrumb through the month, the line naming the kind, the page count, the size and the date read from the file, the tabs Document, Extracted text and Related notes with the download of the original, the strip of pages beside the rendering of the current page and its notes, the extracted text and the notes reachable by their anchors; in the panel the properties read from the file, the three files that make the document, the related pages, the neighbourhood folded",
  ...chrome,
  header: documentHeader,
  footer: corporateFooter,
  props: documentPageCorporate,
};
