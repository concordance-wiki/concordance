import { chrome, type GalleryPage } from "../page.js";

export const mentionsPanelEmptyState: GalleryPage = {
  file: "mentions-panel-empty.html",
  slot: "MentionsPanel",
  rendered: "MentionsPanel",
  state: "empty",
  description: "no mention at all: the block says that no page evokes the entity yet",
  ...chrome,
  props: { mentions: [], initial: 20 },
};
