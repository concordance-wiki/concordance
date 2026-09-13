import { chrome, type GalleryPage } from "../page.js";
import { entityPage } from "../fixtures/entity-page.js";

export const entityPageState: GalleryPage = {
  file: "entity-page.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "default",
  description:
    "title, badge and highlights, two sections, the properties and the table of contents in the panel, one related page, the neighbourhood folded, a source",
  ...chrome,
  props: entityPage,
};
