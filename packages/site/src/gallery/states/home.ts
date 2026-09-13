import { chrome, type GalleryPage } from "../page.js";
import { home } from "../fixtures/home.js";

export const homeState: GalleryPage = {
  file: "home.html",
  slot: "Home",
  rendered: "Home",
  state: "default",
  description:
    "the question and the search field, the shortcuts, four spaces with their trees folded, one dormant, the latest changes and the alert",
  ...chrome,
  props: home,
};
