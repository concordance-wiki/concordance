import { wireDocumentViewer, type ViewerModule } from "./document-viewer.js";
import { ISLAND_ELEMENT } from "./element.js";

for (const element of document.querySelectorAll<HTMLElement>(
  `${ISLAND_ELEMENT}[data-island="document-viewer"]`,
)) {
  wireDocumentViewer(element, {
    // A dynamic import of the hashed bundle, whose href is relative to the page and not to this
    // script: the page never loads it before the reader asks.
    importViewer: (href) => import(new URL(href, document.baseURI).href) as Promise<ViewerModule>,
  });
}
