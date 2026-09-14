import type { GalleryPage } from "../page.js";
import { keywordPageCorporateState } from "./keyword-page-corporate.js";

export const keywordPageNoScriptState: GalleryPage = {
  ...keywordPageCorporateState,
  file: "keyword-page-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the keyword-page-corporate state without the scripts of its islands, what a reader without JavaScript gets; the passages and their folds served as details elements, the related pages with the link to their fragment",
  board: "B5",
  scripts: false,
};
