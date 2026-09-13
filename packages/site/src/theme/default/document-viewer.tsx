import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { DocumentView } from "../../slots.js";
import { labels } from "./labels.js";

export const DOCUMENT_VIEWER_ISLAND = "document-viewer";

/** The strings the viewer shows once it runs, handed over as props so that no visible string lives in a bundle. */
export interface ViewerLabels {
  openViewer: string;
  closeViewer: string;
  loadingViewer: string;
  viewerUnavailable: string;
  openPdf: string;
  previousPage: string;
  nextPage: string;
  zoomIn: string;
  zoomOut: string;
  findInDocument: string;
  noMatch: string;
  matchesOn: string;
  /** The singular name of a position, `page` or `slide`, for the counter of the viewer. */
  unit: string;
}

/** What the client entry needs: the PDF, the bundles to import on demand, and the labels. */
export interface DocumentViewerProps {
  pdfHref: string;
  viewerHref: string;
  workerHref: string;
  labels: ViewerLabels;
}

export const viewerLabels = (unit: DocumentView["unit"]): ViewerLabels => ({
  openViewer: labels.openViewer,
  closeViewer: labels.closeViewer,
  loadingViewer: labels.loadingViewer,
  viewerUnavailable: labels.viewerUnavailable,
  openPdf: labels.openPdf,
  previousPage: labels.previousPage,
  nextPage: labels.nextPage,
  zoomIn: labels.zoomIn,
  zoomOut: labels.zoomOut,
  findInDocument: labels.findInDocument,
  noMatch: labels.noMatch,
  matchesOn: labels.matchesOn,
  unit: unit === "slide" ? "slide" : "page",
});

/**
 * The id of the block of a position, the anchor the mentions point at: `L3` for the third one of
 * the first document of the page; a further document on the same page suffixes its rank, so that
 * ids stay unique.
 */
export function positionAnchor(number: number, index = 1): string {
  return index === 1 ? `L${String(number)}` : `L${String(number)}-${String(index)}`;
}

/** The first line of the text of a position, cut short, as the rail names it. */
export function positionCaption(text: string, max = 60): string {
  const line =
    text
      .split("\n")
      .find((candidate) => candidate.trim() !== "")
      ?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function railHeading(unit: DocumentView["unit"]): string {
  switch (unit) {
    case "slide":
      return labels.slides;
    case "cue":
      return labels.cues;
    case "page":
      return labels.pages;
  }
}

/**
 * The opener of the viewer: a button served hidden and a container, both wired by the island's
 * script; without JavaScript the reader has the links and the text around them.
 */
function ViewerOpener(props: DocumentViewerProps): JSX.Element {
  return (
    <div class="document-opener">
      <button type="button" class="document-open" hidden>
        {props.labels.openViewer}
      </button>
      <div class="document-viewer" hidden />
    </div>
  );
}

const ViewerIsland = island(DOCUMENT_VIEWER_ISLAND, ViewerOpener);

/**
 * One document of the page: the download link, the PDF link and, when the build produced the
 * viewer, the island that opens it on demand; then the rail of positions, each leading to its
 * text, and the extracted text position by position in disclosure blocks. Everything but the
 * viewer itself works without JavaScript.
 */
export function DocumentBlock({
  document,
  index,
}: {
  document: DocumentView;
  index: number;
}): JSX.Element {
  const id = `document-${String(index)}`;
  const { file, preview, positions } = document;
  const viewer =
    preview?.viewerHref !== undefined && preview.workerHref !== undefined
      ? {
          pdfHref: preview.href,
          viewerHref: preview.viewerHref,
          workerHref: preview.workerHref,
          labels: viewerLabels(document.unit),
        }
      : undefined;
  return (
    <section class={`document document-${document.unit}`} aria-labelledby={id}>
      <h2 id={id}>
        {labels.document} <code>{file.label}</code>
      </h2>
      <p class="document-files">
        <a class="document-download" href={file.href} download={file.label}>
          {labels.download} {file.label}
        </a>
        {preview !== undefined && (
          <a class="document-pdf" href={preview.href}>
            {labels.openPdf}
          </a>
        )}
      </p>
      {viewer !== undefined && <ViewerIsland {...viewer} />}
      {positions.length > 0 && (
        <nav class="document-rail" aria-label={railHeading(document.unit)}>
          <ol>
            {positions.map((position) => (
              <li key={position.number}>
                <a
                  href={`#${positionAnchor(position.number, index)}`}
                  data-position={position.number}
                >
                  <span class="document-position">{position.label}</span>
                  {positionCaption(position.text) !== "" && (
                    <span class="document-caption">{positionCaption(position.text)}</span>
                  )}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div class="document-text">
        <h3>{labels.extractedText}</h3>
        {positions.length === 0 ? (
          <p class="empty">{labels.noExtractedText}</p>
        ) : (
          positions.map((position) => (
            <details
              key={position.number}
              id={positionAnchor(position.number, index)}
              open={position.number === 1}
            >
              <summary>{position.label}</summary>
              <p>{position.text}</p>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
