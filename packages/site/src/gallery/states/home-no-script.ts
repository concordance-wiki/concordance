import type { GalleryPage } from "../page.js";
import { homeCorporateState } from "./home-corporate.js";

export const homeNoScriptState: GalleryPage = {
  ...homeCorporateState,
  file: "home-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the home-corporate state without the scripts of its islands, what a reader without JavaScript gets; the search field a plain form to the results page, no live results under it",
  board: "B1",
  scripts: false,
};
