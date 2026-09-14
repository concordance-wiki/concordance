import { chrome, type GalleryPage } from "../page.js";
import { footerWithText } from "../fixtures/chrome.js";
import { todo } from "../fixtures/todo.js";

export const footerTextState: GalleryPage = {
  file: "footer-text.html",
  slot: "Footer",
  rendered: "Todo",
  state: "text",
  description:
    "the footer with a project text, no link and no mention of the tool, below the to-do page",
  board: "chrome",
  ...chrome,
  footer: footerWithText,
  props: todo,
};
