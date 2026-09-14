import { chrome, type GalleryPage } from "../page.js";
import { corporateEntityPage } from "../fixtures/entity-page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const entityPagePanelFoldedState: GalleryPage = {
  file: "entity-page-panel-folded.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "panel folded",
  description:
    "server HTML only: the same page with both side panels served folded behind their handles, as a reader who folded them sees every page afterwards: the tree keeps its initials badge and its name written upwards on 44 px, the right panel the headings of its blocks, the handles show on the edges half slid behind the panels, and the room goes to the wide content of the text while the prose keeps its measure",
  board: "B21",
  scripts: false,
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: { ...corporateEntityPage, folded: ["tree", "panel"] },
};
