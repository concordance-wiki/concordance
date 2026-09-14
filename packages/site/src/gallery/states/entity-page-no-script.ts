import type { GalleryPage } from "../page.js";
import { entityPageCorporateState } from "./entity-page-corporate.js";

export const entityPageNoScriptState: GalleryPage = {
  ...entityPageCorporateState,
  file: "entity-page-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the entity-page-corporate state without the scripts of its islands, what a reader without JavaScript gets; the table of contents without the marked entry, the related pages as served with the link to their fragment, every disclosure a details element",
  board: "B2",
  scripts: false,
};
