import { chrome, type GalleryPage } from "../page.js";
import { keywordPage } from "../fixtures/keyword-page.js";

export const keywordPageState: GalleryPage = {
  file: "keyword-page.html",
  slot: "KeywordPage",
  rendered: "KeywordPage",
  state: "default",
  description:
    "the notice, the passages by file, the counts, the similar forms and the neighbourhood of its co-occurrences, without a space",
  ...chrome,
  props: keywordPage,
};
