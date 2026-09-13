import type { ViewerHandle, ViewerOptions, ViewerPosition } from "./document-viewer.js";

/**
 * The part of pdf.js the viewer uses, so that the logic is tested against a double; the viewport
 * type is the library's own, handed back to it untouched.
 */
export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfPage<V extends PdfViewport> {
  getViewport(params: { scale: number }): V;
  render(params: { canvas: HTMLCanvasElement; viewport: V }): { promise: Promise<void> };
}

export interface PdfDocument<V extends PdfViewport> {
  numPages: number;
  getPage(number: number): Promise<PdfPage<V>>;
}

/** The loading of a document: its promise, and the release of everything once the viewer closes. */
export interface PdfLoadingTask<V extends PdfViewport> {
  promise: Promise<PdfDocument<V>>;
  destroy(): Promise<void>;
}

export interface PdfLibrary<V extends PdfViewport> {
  getDocument(params: { url: string }): PdfLoadingTask<V>;
}

export const ZOOM_STEPS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
export const DEFAULT_ZOOM = 1;

/** The positions whose text contains the query, case folded; none for a blank query. */
export function matchingPositions(positions: readonly ViewerPosition[], query: string): number[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return [];
  return positions
    .filter((position) => position.text.toLocaleLowerCase().includes(needle))
    .map((position) => position.number);
}

/** The step next to the current zoom in the given direction, the ends holding. */
export function nextZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.indexOf(current);
  const next = ZOOM_STEPS[index + direction];
  return next ?? current;
}

interface Controls {
  counter: HTMLElement;
  zoomOut: HTMLButtonElement;
  /** The zoom as a percentage, between its two buttons. */
  zoom: HTMLElement;
  zoomIn: HTMLButtonElement;
  find: HTMLInputElement;
  status: HTMLElement;
  canvas: HTMLCanvasElement;
}

/** A button drawn as a glyph, named for assistive technology. */
function button(doc: Document, glyph: string, label: string, className: string): HTMLButtonElement {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = glyph;
  element.setAttribute("aria-label", label);
  return element;
}

function span(doc: Document, className: string, text = ""): HTMLElement {
  const element = doc.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function separator(doc: Document): HTMLElement {
  const element = span(doc, "viewer-separator", "|");
  element.setAttribute("aria-hidden", "true");
  return element;
}

/** The zoom as the toolbar shows it, a percentage with a space before its sign. */
export function zoomLabel(zoom: number): string {
  return `${String(Math.round(zoom * 100))} %`;
}

/**
 * The toolbar and the stage of the viewer, appended to the host: the counter of the position
 * shown, the zoom between its two buttons, the find field over the extracted text with its
 * status, then the canvas on its stage. The pages are reached through the strip of the page,
 * which drives the viewer.
 */
function buildControls(host: HTMLElement, options: ViewerOptions): Controls {
  const doc = host.ownerDocument;
  const { labels } = options;
  const toolbar = doc.createElement("div");
  toolbar.className = "viewer-toolbar";
  toolbar.setAttribute("role", "toolbar");
  const counter = span(doc, "viewer-counter");
  counter.setAttribute("aria-live", "polite");
  const zoomOut = button(doc, "\u2212", labels.zoomOut, "viewer-zoom-out");
  const zoom = span(doc, "viewer-zoom");
  const zoomIn = button(doc, "+", labels.zoomIn, "viewer-zoom-in");
  const findLabel = doc.createElement("label");
  findLabel.className = "viewer-find";
  const glyph = span(doc, "viewer-find-glyph", "\u2315");
  glyph.setAttribute("aria-hidden", "true");
  findLabel.append(glyph, span(doc, "visually-hidden", labels.findInDocument));
  const find = doc.createElement("input");
  find.type = "search";
  find.placeholder = labels.inTheDocument;
  findLabel.append(find);
  const status = span(doc, "viewer-status");
  status.setAttribute("role", "status");
  toolbar.append(counter, separator(doc), zoomOut, zoom, zoomIn, separator(doc), findLabel, status);
  const stage = doc.createElement("div");
  stage.className = "viewer-stage";
  const canvas = doc.createElement("canvas");
  canvas.className = "viewer-page";
  stage.append(canvas);
  host.replaceChildren(toolbar, stage);
  return { counter, zoomOut, zoom, zoomIn, find, status, canvas };
}

/**
 * Opens the PDF in the host with pdf.js: one page drawn on a canvas at a time, reached through
 * `goTo` as the strip of the page asks, zoom in and out over fixed steps, and a find box over
 * the extracted text of the positions that jumps to the first matching page and counts the
 * others. The rail of the page follows through `onPage`.
 */
export async function createViewer<V extends PdfViewport>(
  pdf: PdfLibrary<V>,
  host: HTMLElement,
  options: ViewerOptions,
): Promise<ViewerHandle> {
  const task = pdf.getDocument({ url: options.pdfHref });
  const document = await task.promise;
  const controls = buildControls(host, options);
  let current = 1;
  let zoom = DEFAULT_ZOOM;
  let matches: number[] = [];
  let rendering: Promise<void> = Promise.resolve();
  let wanted = "";

  const draw = async (): Promise<void> => {
    const page = await document.getPage(current);
    const viewport = page.getViewport({ scale: zoom });
    controls.canvas.width = Math.ceil(viewport.width);
    controls.canvas.height = Math.ceil(viewport.height);
    controls.canvas.setAttribute(
      "aria-label",
      `${options.labels.unit} ${String(current)} / ${String(document.numPages)}`,
    );
    await page.render({ canvas: controls.canvas, viewport }).promise;
  };
  const refresh = (): void => {
    controls.counter.replaceChildren(
      span(host.ownerDocument, "visually-hidden", `${options.labels.unit} `),
      `${String(current)} / ${String(document.numPages)}`,
    );
    controls.zoom.textContent = zoomLabel(zoom);
    controls.zoomOut.disabled = nextZoom(zoom, -1) === zoom;
    controls.zoomIn.disabled = nextZoom(zoom, 1) === zoom;
    // Renders queue up so that a fast reader never sees two pages race for the canvas, and a
    // queued render that a later request made stale is skipped.
    const asked = `${String(current)}@${String(zoom)}`;
    wanted = asked;
    const attempt = (): Promise<void> => (wanted === asked ? draw() : Promise.resolve());
    rendering = rendering.then(attempt, attempt);
    options.onPage?.(current);
  };
  const goTo = (number: number): void => {
    if (!Number.isInteger(number) || number < 1 || number > document.numPages) return;
    current = number;
    refresh();
  };
  const showMatches = (): void => {
    if (controls.find.value.trim() === "") {
      controls.status.textContent = "";
      return;
    }
    const positions = matches.map((match) => `${options.labels.unit} ${String(match)}`).join(", ");
    controls.status.textContent =
      matches.length === 0
        ? options.labels.noMatch
        : `${String(matches.length)} ${options.labels.matchesOn} ${positions}`;
  };

  controls.zoomOut.addEventListener("click", () => {
    zoom = nextZoom(zoom, -1);
    refresh();
  });
  controls.zoomIn.addEventListener("click", () => {
    zoom = nextZoom(zoom, 1);
    refresh();
  });
  controls.find.addEventListener("input", () => {
    matches = matchingPositions(options.positions, controls.find.value);
    showMatches();
    const [first] = matches;
    if (first !== undefined && first !== current) goTo(first);
  });
  refresh();
  await rendering;
  return {
    goTo,
    close: () => {
      host.replaceChildren();
      void task.destroy();
    },
  };
}
