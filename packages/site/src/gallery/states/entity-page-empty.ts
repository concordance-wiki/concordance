import { chrome, type GalleryPage } from "../page.js";
import { entityPage } from "../fixtures/entity-page.js";

export const entityPageEmptyState: GalleryPage = {
  file: "entity-page-empty.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "empty",
  description: "an entity without attributes, neighbours or mentions: the panels say so",
  ...chrome,
  props: {
    ...entityPage,
    highlights: [],
    attributes: [],
    neighbours: { centre: entityPage.entity.title, neighbours: [] },
    mentions: { mentions: [], initial: 20 },
  },
};
