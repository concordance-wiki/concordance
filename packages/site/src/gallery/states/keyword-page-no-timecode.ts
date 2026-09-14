import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { keywordPageWithoutTimecode } from "../fixtures/degraded.js";

export const keywordPageNoTimecodeState: GalleryPage = {
  file: "keyword-page-no-timecode.html",
  slot: "KeywordPage",
  rendered: "KeywordPage",
  state: "no-timecode",
  description:
    "the keyword page whose transcript passages carry no timecode, the reader of the transcript having given none: each of them names its line as a note does, the pages and the lines of the other files unchanged",
  board: "B5",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: keywordPageWithoutTimecode,
};
