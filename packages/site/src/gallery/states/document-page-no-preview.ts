import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { documentHeader } from "../fixtures/document-page.js";
import { documentPageNoPreview } from "../fixtures/edge-cases.js";

export const documentPageNoPreviewState: GalleryPage = {
  file: "document-page-no-preview.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "document-page-no-preview",
  description:
    "the framing deck when its conversion timed out: in place of the rendering, the notice ruled in the accent names the fact, says the text was extracted all the same, offers the original and unfolds the finding the build recorded, the cause first and the check identifier after it; then the extracted text slide by slide, indexed and searchable; in the panel the state of every representation, the preview written as failed",
  board: "B17",
  ...chrome,
  header: documentHeader,
  footer: corporateFooter,
  props: documentPageNoPreview,
};
