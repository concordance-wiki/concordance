import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { entityPageWithoutProperty } from "../fixtures/degraded.js";

export const entityPageNoPropertyState: GalleryPage = {
  file: "entity-page-no-property.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "no-property",
  description:
    "the rule of the corporate state written without any frontmatter beyond its type: the line under the title still reads the type, the date and the space, the properties block says the note declares nothing, the rest of the page is unchanged",
  board: "B2",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: entityPageWithoutProperty,
};
