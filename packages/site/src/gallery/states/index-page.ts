import { chrome, type GalleryPage } from "../page.js";
import { index } from "../fixtures/index-page.js";

export const indexPageState: GalleryPage = {
  file: "index-page.html",
  slot: "Index",
  rendered: "Index",
  state: "default",
  description:
    "the letters, one inactive, and the entries of one segment, one without a note; named after the source file, the gallery keeping index.html for itself",
  board: "B10",
  ...chrome,
  props: index,
};
