import {
  getDocument,
  GlobalWorkerOptions,
  type PageViewport,
} from "pdfjs-dist/legacy/build/pdf.mjs";

import type { ViewerHandle, ViewerOptions } from "./document-viewer.js";
import { createViewer, type PdfLibrary } from "./viewer-pdf.js";

/** pdf.js as the viewer sees it; the viewport type is the library's, so that its pages accept it back. */
const library: PdfLibrary<PageViewport> = { getDocument };

/**
 * The entry of the viewer bundle, imported on demand by the document island: points pdf.js at
 * its worker bundle, then opens the PDF in the host.
 */
export function openViewer(host: HTMLElement, options: ViewerOptions): Promise<ViewerHandle> {
  GlobalWorkerOptions.workerSrc = new URL(options.workerHref, host.ownerDocument.baseURI).href;
  return createViewer(library, host, options);
}
