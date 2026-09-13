import type { DocumentViewerProps, ViewerLabels } from "../theme/default/document-viewer.js";

/** A position of the document as the viewer searches it: its number and its extracted text. */
export interface ViewerPosition {
  number: number;
  text: string;
}

/** What the opener hands to the viewer once its bundle is imported. */
export interface ViewerOptions {
  pdfHref: string;
  workerHref: string;
  labels: ViewerLabels;
  positions: ViewerPosition[];
  /** Called with the number of the page shown, so that the rail can follow. */
  onPage?: (number: number) => void;
}

/** What the viewer gives back: a way to show a page and to close. */
export interface ViewerHandle {
  goTo(number: number): void;
  close(): void;
}

/** The default export shape of the viewer bundle. */
export interface ViewerModule {
  openViewer(host: HTMLElement, options: ViewerOptions): Promise<ViewerHandle>;
}

export interface OpenerDependencies {
  /** Imports the viewer bundle by its href relative to the page; fails over `file://` in some browsers. */
  importViewer: (href: string) => Promise<ViewerModule>;
}

/** The positions of the document, read from the text blocks the page serves, so that the props stay small. */
export function positionsOf(section: ParentNode): ViewerPosition[] {
  return [...section.querySelectorAll<HTMLElement>(".document-text details[id]")].map(
    (details) => ({
      // `L3`, or `L3-2` on the second document of the page: the number comes first.
      number: Number.parseInt(details.id.slice(1), 10),
      text: details.querySelector("p")?.textContent ?? "",
    }),
  );
}

/** Marks the rail entry of the page shown. */
function followRail(section: ParentNode, number: number): void {
  for (const entry of section.querySelectorAll<HTMLElement>(".document-rail a[data-position]")) {
    const current = Number(entry.dataset["position"]) === number;
    entry.classList.toggle("current", current);
    if (current) {
      entry.setAttribute("aria-current", "true");
    } else {
      entry.removeAttribute("aria-current");
    }
  }
}

function fallback(container: HTMLElement, props: DocumentViewerProps): void {
  container.replaceChildren();
  const notice = container.ownerDocument.createElement("p");
  notice.className = "document-unavailable";
  notice.setAttribute("role", "status");
  notice.append(`${props.labels.viewerUnavailable}. `);
  const link = container.ownerDocument.createElement("a");
  link.href = props.pdfHref;
  link.textContent = props.labels.openPdf;
  notice.append(link);
  container.append(notice);
  container.hidden = false;
}

/**
 * Reveals the button of one document island and makes it import the viewer bundle on the first
 * click, then open the viewer on the PDF; the button toggles the viewer afterwards, and the rail
 * follows the page shown. When the bundle cannot be imported, the reader gets a link to the PDF.
 */
export function wireDocumentViewer(element: HTMLElement, deps: OpenerDependencies): boolean {
  const button = element.querySelector<HTMLButtonElement>("button.document-open");
  const container = element.querySelector<HTMLElement>(".document-viewer");
  const section = element.closest<HTMLElement>("section.document");
  const serialised = element.getAttribute("data-props");
  if (button === null || container === null || section === null || serialised === null) {
    return false;
  }
  // Written by island() at build: the attribute carries the props of the opener.
  const props = JSON.parse(serialised) as DocumentViewerProps;
  let handle: ViewerHandle | undefined;
  let opening = false;
  const show = (open: boolean): void => {
    container.hidden = !open;
    button.textContent = open ? props.labels.closeViewer : props.labels.openViewer;
    button.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const open = async (): Promise<void> => {
    opening = true;
    button.disabled = true;
    button.textContent = props.labels.loadingViewer;
    try {
      const module = await deps.importViewer(props.viewerHref);
      handle = await module.openViewer(container, {
        pdfHref: props.pdfHref,
        workerHref: props.workerHref,
        labels: props.labels,
        positions: positionsOf(section),
        onPage: (number) => {
          followRail(section, number);
        },
      });
      button.disabled = false;
      show(true);
    } catch {
      button.hidden = true;
      fallback(container, props);
    } finally {
      opening = false;
    }
  };
  button.addEventListener("click", () => {
    if (opening) return;
    if (handle === undefined) {
      void open();
    } else {
      show(container.hidden);
    }
  });
  for (const entry of section.querySelectorAll<HTMLElement>(".document-rail a[data-position]")) {
    entry.addEventListener("click", () => {
      handle?.goTo(Number(entry.dataset["position"]));
    });
  }
  show(false);
  button.hidden = false;
  return true;
}
