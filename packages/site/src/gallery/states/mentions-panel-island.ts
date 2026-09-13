import { chrome, type GalleryPage } from "../page.js";
import { mentions } from "../fixtures/mentions.js";

export const mentionsPanelIslandState: GalleryPage = {
  file: "mentions-panel-island.html",
  slot: "MentionsPanel",
  rendered: "MentionsPanel",
  state: "island",
  description:
    "twenty-five mentions in nine notes: the seven pages of the first twenty inline, the rest embedded for the island, the link to the fragment standing meanwhile, readable without JavaScript",
  ...chrome,
  props: {
    mentions: mentions(25),
    initial: 20,
    fragmentHref: "../fragments/glossary/keyword-page.mentions.json",
  },
};
