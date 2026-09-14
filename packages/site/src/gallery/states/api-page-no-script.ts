import type { GalleryPage } from "../page.js";
import { apiPageCorporateState } from "./api-page-corporate.js";

export const apiPageNoScriptState: GalleryPage = {
  ...apiPageCorporateState,
  file: "api-page-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the api-page-corporate state without the scripts of its islands, what a reader without JavaScript gets; the contract block holding the link to its JSON view in place of the viewer",
  board: "B7",
  scripts: false,
};
