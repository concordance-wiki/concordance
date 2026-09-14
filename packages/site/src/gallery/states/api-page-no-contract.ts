import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { apiPageWithoutContract } from "../fixtures/degraded.js";

export const apiPageNoContractState: GalleryPage = {
  file: "api-page-no-contract.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "no-contract",
  description:
    "the API page when the contract its note points at could not be fetched: no contract record in the model, so the page falls back to the generic layout, the notice under the title naming the fact, what remains, the declared address as an exit and the finding behind its disclosure, the note and the properties with the contract path as written, the operations among the related pages, no operations table, no contract block, no viewer",
  board: "B7",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: apiPageWithoutContract,
};
