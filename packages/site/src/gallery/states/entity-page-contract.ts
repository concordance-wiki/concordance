import { chrome, type GalleryPage } from "../page.js";
import { apiPage } from "../fixtures/api-page.js";

export const entityPageContractState: GalleryPage = {
  file: "entity-page-contract.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "contract",
  description:
    "an API whose contract was imported, in the default chrome: the operations table after the note with one operation the contract declares without a page, the contract block with the viewer behind its button, the properties cut to five keys",
  ...chrome,
  props: apiPage,
};
