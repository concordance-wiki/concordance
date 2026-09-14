import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateIndex } from "../fixtures/index-page.js";

export const indexCorporateState: GalleryPage = {
  file: "index-corporate.html",
  slot: "Index",
  rendered: "Index",
  state: "corporate",
  description:
    "the letter S of the fixtures corpus in the corporate chrome, the index being segmented: the sentence counting the words and those with a note, the filters folded behind their button, by type, by space and without a definition, the letter bar with its inactive letters struck through and the count of the letters without an entry, the heading of the letter with its count, the table of the words with their type, their first line and the pages citing them, two homonyms among them and a word without a definition dotted with the passage that uses it most, and the note on those words at the foot",
  board: "B10",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateIndex,
};
