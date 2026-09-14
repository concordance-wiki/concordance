import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { todo } from "../fixtures/todo.js";

export const todoCorporateState: GalleryPage = {
  file: "todo-corporate.html",
  slot: "Todo",
  rendered: "Todo",
  state: "corporate",
  description:
    "the to-do page in the corporate chrome: the deck of the fixtures corpus without a markdown representation, two words above the threshold without a note with their occurrences and files, the suspected noise folded under its count with the reason of each expression, and the call to add them to the stopwords",
  board: "todo",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: todo,
};
