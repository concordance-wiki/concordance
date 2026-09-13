import { chrome, type GalleryPage } from "../page.js";
import { mentions } from "../fixtures/mentions.js";

export const mentionsPanelState: GalleryPage = {
  file: "mentions-panel.html",
  slot: "MentionsPanel",
  rendered: "MentionsPanel",
  state: "default",
  description:
    "three mentions in one note, two written and one recognised: one related page, cited, with three passages",
  ...chrome,
  props: { mentions: mentions(3), initial: 20 },
};
