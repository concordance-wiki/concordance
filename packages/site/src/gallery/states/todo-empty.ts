import { chrome, type GalleryPage } from "../page.js";

export const todoEmptyState: GalleryPage = {
  file: "todo-empty.html",
  slot: "Todo",
  rendered: "Todo",
  state: "empty",
  description: "nothing to do in either list",
  ...chrome,
  props: { documents: [], terms: [] },
};
