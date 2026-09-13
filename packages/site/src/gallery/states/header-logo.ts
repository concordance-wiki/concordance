import { chrome, type GalleryPage } from "../page.js";
import { headerWithLogo } from "../fixtures/chrome.js";
import { todo } from "../fixtures/todo.js";

export const headerLogoState: GalleryPage = {
  file: "header-logo.html",
  slot: "Header",
  rendered: "Todo",
  state: "logo",
  description: "the header with a logo and without a search field, above the to-do page",
  ...chrome,
  header: headerWithLogo,
  props: todo,
};
