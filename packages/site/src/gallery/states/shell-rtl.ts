import { chrome, type GalleryPage } from "../page.js";
import { home } from "../fixtures/home.js";

export const shellRtlState: GalleryPage = {
  file: "shell-rtl.html",
  slot: "Shell",
  rendered: "Home",
  state: "rtl",
  description:
    "the home page in a right-to-left locale: lang and dir change, the stylesheet does not",
  ...chrome,
  locale: "ar",
  props: home,
};
