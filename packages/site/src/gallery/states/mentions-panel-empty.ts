import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const mentionsPanelEmptyState: GalleryPage = {
  file: "mentions-panel-empty.html",
  slot: "MentionsPanel",
  rendered: "MentionsPanel",
  state: "empty",
  description: "no mention at all: the block says that no page evokes the entity yet",
  board: "panels",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: { mentions: [], initial: 20 },
};
