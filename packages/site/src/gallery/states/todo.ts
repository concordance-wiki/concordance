import { chrome, type GalleryPage } from "../page.js";
import { todo } from "../fixtures/todo.js";

export const todoState: GalleryPage = {
  file: "todo.html",
  slot: "Todo",
  rendered: "Todo",
  state: "default",
  description: "one document without markdown and two words without a note",
  board: "todo",
  ...chrome,
  props: todo,
};
