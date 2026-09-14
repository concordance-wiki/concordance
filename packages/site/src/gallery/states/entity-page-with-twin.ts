import { chrome, type GalleryPage } from "../page.js";
import { entityPageWithTwin } from "../fixtures/entity-page-twin.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPageWithTwinState: GalleryPage = {
  file: "entity-page-with-twin.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "with-twin",
  description:
    "a rule of the specifications space whose Word equivalent the build grouped with the note: the page keeps the template of a rule, the document folded under the article behind the line naming the file, its kind and its pages, the viewer and the extracted text on demand",
  board: "B2",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: entityPageWithTwin,
};
