import { chrome, type GalleryPage } from "../page.js";
import { keywordPage } from "../fixtures/keyword-page.js";

export const keywordPageEmptyState: GalleryPage = {
  file: "keyword-page-empty.html",
  slot: "KeywordPage",
  rendered: "KeywordPage",
  state: "empty",
  description: "a keyword without passages, companions or similar forms",
  ...chrome,
  props: {
    ...keywordPage,
    counts: { occurrences: 0, files: 0, sources: 0 },
    spaces: [],
    summary: "0 files.",
    passages: [],
    companions: [],
    similar: [],
  },
};
