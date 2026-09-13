import { chrome, type GalleryPage } from "../page.js";
import { documentEntityPage } from "../fixtures/document-blocks.js";

export const entityPageDocumentState: GalleryPage = {
  file: "entity-page-document.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "document",
  description:
    "a workshop with a deck and a transcript: download links, the viewer opened on demand, the rail of slides, the extracted text",
  ...chrome,
  props: documentEntityPage,
};
