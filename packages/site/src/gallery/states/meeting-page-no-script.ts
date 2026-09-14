import type { GalleryPage } from "../page.js";
import { meetingPageCorporateState } from "./meeting-page-corporate.js";

export const meetingPageNoScriptState: GalleryPage = {
  ...meetingPageCorporateState,
  file: "meeting-page-no-script.html",
  state: "no-script",
  description:
    "server HTML only: the meeting-page-corporate state without the scripts of its islands, what a reader without JavaScript gets; the tabs as anchors to panels the stylesheet shows one at a time, the deck as the browser shows a PDF behind its noscript element",
  board: "B6",
  scripts: false,
};
