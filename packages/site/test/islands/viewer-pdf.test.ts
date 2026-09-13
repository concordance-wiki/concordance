// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import type { ViewerOptions } from "../../src/islands/document-viewer.js";
import {
  createViewer,
  DEFAULT_ZOOM,
  matchingPositions,
  nextZoom,
  ZOOM_STEPS,
  zoomLabel,
  type PdfLibrary,
  type PdfViewport,
} from "../../src/islands/viewer-pdf.js";
import { viewerLabels } from "../../src/theme/default/document-viewer.js";

interface Rendered {
  page: number;
  scale: number;
  width: number;
  height: number;
}

/** A pdf.js double: pages of 100 by 50 points at scale 1, every render recorded. */
function fakeLibrary(numPages: number) {
  const rendered: Rendered[] = [];
  const requested: string[] = [];
  let destroyed = 0;
  let pending: (() => void) | undefined;
  const library: PdfLibrary<PdfViewport> = {
    getDocument: ({ url }) => {
      requested.push(url);
      return {
        promise: Promise.resolve({
          numPages,
          getPage: (number) =>
            Promise.resolve({
              getViewport: ({ scale }) => ({ width: 100 * scale, height: 50 * scale }),
              render: ({ canvas, viewport }) => {
                rendered.push({
                  page: number,
                  scale: viewport.width / 100,
                  width: canvas.width,
                  height: canvas.height,
                });
                return {
                  promise: new Promise<void>((resolve) => {
                    pending = resolve;
                  }),
                };
              },
            }),
        }),
        destroy: () => {
          destroyed += 1;
          return Promise.resolve();
        },
      };
    },
  };
  /** Lets the render in progress finish, as the browser would once the canvas is painted. */
  const paint = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    pending?.();
    pending = undefined;
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { library, rendered, requested, paint, destroyed: () => destroyed };
}

const positions = [
  { number: 1, text: "Keyword page threshold review" },
  { number: 2, text: "Three occurrences in two files" },
  { number: 3, text: "" },
  { number: 4, text: "Build summary: keyword pages and discarded expressions" },
];

function options(withRail = true): ViewerOptions & { shown: number[] } {
  const shown: number[] = [];
  return {
    pdfHref: "meetings/threshold-review.pdf",
    workerHref: "../../../assets/viewer-pdf-worker-00000000.js",
    labels: viewerLabels("slide"),
    positions,
    ...(withRail
      ? {
          onPage: (number: number) => {
            shown.push(number);
          },
        }
      : {}),
    shown,
  };
}

async function open(numPages = 4, withRail = true) {
  const fake = fakeLibrary(numPages);
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  const opts = options(withRail);
  const opening = createViewer(fake.library, host, opts);
  await fake.paint();
  const handle = await opening;
  const query = (selector: string): HTMLElement & HTMLButtonElement & HTMLInputElement => {
    const element = host.querySelector<HTMLElement & HTMLButtonElement & HTMLInputElement>(
      selector,
    );
    if (element === null) throw new Error(`${selector} is missing`);
    return element;
  };
  return { ...fake, host, handle, opts, query };
}

describe("The viewer-pdf plugin renders the PDF through pdf.js, with page navigation, zoom and internal search", () => {
  it("opens the PDF of the page, draws its first page on a canvas on its stage at the default zoom and tells the rail", async () => {
    const viewer = await open();
    expect(viewer.requested).toEqual(["meetings/threshold-review.pdf"]);
    expect(viewer.rendered).toEqual([{ page: 1, scale: 1, width: 100, height: 50 }]);
    expect(viewer.query("canvas.viewer-page").getAttribute("aria-label")).toBe("slide 1 / 4");
    expect(viewer.query(".viewer-stage > canvas.viewer-page")).toBeDefined();
    expect(viewer.query(".viewer-toolbar").getAttribute("role")).toBe("toolbar");
    expect(viewer.opts.shown).toEqual([1]);
    expect(DEFAULT_ZOOM).toBe(1);
  });

  it("lays the toolbar out as the counter, the zoom between its two signs and the find field after its glyph, the unit and the names kept for assistive technology", async () => {
    const viewer = await open();
    const toolbar = viewer.query(".viewer-toolbar");
    expect([...toolbar.children].map((child) => child.className)).toEqual([
      "viewer-counter",
      "viewer-separator",
      "viewer-zoom-out",
      "viewer-zoom",
      "viewer-zoom-in",
      "viewer-separator",
      "viewer-find",
      "viewer-status",
    ]);
    expect(viewer.query(".viewer-counter").textContent).toBe("slide 1 / 4");
    expect(viewer.query(".viewer-counter .visually-hidden").textContent).toBe("slide ");
    expect(viewer.query(".viewer-counter").getAttribute("aria-live")).toBe("polite");
    expect(viewer.query(".viewer-zoom").textContent).toBe("100 %");
    expect(viewer.query(".viewer-zoom-out").textContent).toBe("\u2212");
    expect(viewer.query(".viewer-zoom-out").getAttribute("aria-label")).toBe("Zoom out");
    expect(viewer.query(".viewer-zoom-in").textContent).toBe("+");
    expect(viewer.query(".viewer-zoom-in").getAttribute("aria-label")).toBe("Zoom in");
    for (const separator of toolbar.querySelectorAll(".viewer-separator")) {
      expect(separator.textContent).toBe("|");
      expect(separator.getAttribute("aria-hidden")).toBe("true");
    }
    expect(viewer.query(".viewer-find-glyph").textContent).toBe("\u2315");
    expect(viewer.query(".viewer-find-glyph").getAttribute("aria-hidden")).toBe("true");
    expect(viewer.query(".viewer-find .visually-hidden").textContent).toBe("Find in the document");
    expect(viewer.query(".viewer-find input").placeholder).toBe("in the document");
    expect(viewer.query(".viewer-find input").type).toBe("search");
    expect(viewer.query(".viewer-status").getAttribute("role")).toBe("status");
    expect(toolbar.querySelector(".viewer-previous, .viewer-next")).toBeNull();
    expect(zoomLabel(1.25)).toBe("125 %");
    expect(zoomLabel(0.5)).toBe("50 %");
  });

  it("jumps to a page the strip names, the counter following, and stays put on anything that is not a page", async () => {
    const viewer = await open();
    viewer.handle.goTo(2);
    await viewer.paint();
    expect(viewer.rendered.at(-1)?.page).toBe(2);
    expect(viewer.query(".viewer-counter").textContent).toBe("slide 2 / 4");
    viewer.handle.goTo(1);
    await viewer.paint();
    expect(viewer.rendered.at(-1)?.page).toBe(1);
    viewer.handle.goTo(4);
    await viewer.paint();
    expect(viewer.query(".viewer-counter").textContent).toBe("slide 4 / 4");
    // Out of range or not a page: nothing moves.
    viewer.handle.goTo(5);
    viewer.handle.goTo(0);
    viewer.handle.goTo(2.5);
    viewer.handle.goTo(Number.NaN);
    await viewer.paint();
    expect(viewer.rendered.map((render) => render.page)).toEqual([1, 2, 1, 4]);
    expect(viewer.opts.shown).toEqual([1, 2, 1, 4]);
  });

  it("zooms in and out over fixed steps, the canvas resized with the viewport, the percentage shown, the ends disabled", async () => {
    const viewer = await open();
    viewer.query(".viewer-zoom-in").click();
    await viewer.paint();
    expect(viewer.rendered.at(-1)).toEqual({ page: 1, scale: 1.25, width: 125, height: 63 });
    expect(viewer.query(".viewer-zoom").textContent).toBe("125 %");
    viewer.query(".viewer-zoom-out").click();
    await viewer.paint();
    viewer.query(".viewer-zoom-out").click();
    await viewer.paint();
    viewer.query(".viewer-zoom-out").click();
    await viewer.paint();
    expect(viewer.rendered.at(-1)?.scale).toBe(0.5);
    expect(viewer.query(".viewer-zoom").textContent).toBe("50 %");
    expect(viewer.query(".viewer-zoom-out").disabled).toBe(true);
    expect(viewer.query(".viewer-zoom-in").disabled).toBe(false);
    expect(nextZoom(3, 1)).toBe(3);
    expect(nextZoom(0.5, -1)).toBe(0.5);
    expect(nextZoom(1, 1)).toBe(1.25);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(ZOOM_STEPS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2, 3]);
  });

  it("finds a query in the extracted text of the positions, jumps to the first matching page and counts the others", async () => {
    const viewer = await open();
    const find = viewer.query(".viewer-find input");
    find.value = "KEYWORD";
    find.dispatchEvent(new Event("input"));
    await viewer.paint();
    expect(viewer.query(".viewer-status").textContent).toBe("2 found on slide 1, slide 4");
    expect(viewer.rendered.map((render) => render.page)).toEqual([1]);
    find.value = "build summary";
    find.dispatchEvent(new Event("input"));
    await viewer.paint();
    expect(viewer.query(".viewer-status").textContent).toBe("1 found on slide 4");
    expect(viewer.rendered.at(-1)?.page).toBe(4);
    find.value = "neighbourhood";
    find.dispatchEvent(new Event("input"));
    await viewer.paint();
    expect(viewer.query(".viewer-status").textContent).toBe("No match");
    expect(viewer.rendered.at(-1)?.page).toBe(4);
    find.value = "   ";
    find.dispatchEvent(new Event("input"));
    expect(viewer.query(".viewer-status").textContent).toBe("");
    expect(matchingPositions(positions, "Occurrences")).toEqual([2]);
    expect(matchingPositions(positions, "")).toEqual([]);
  });

  it("queues the renders so that two pages never race for the canvas, and skips the one a later request made stale", async () => {
    const viewer = await open();
    viewer.handle.goTo(2);
    viewer.handle.goTo(3);
    expect(viewer.rendered.map((render) => render.page)).toEqual([1]);
    await viewer.paint();
    await viewer.paint();
    expect(viewer.rendered.map((render) => render.page)).toEqual([1, 3]);
    expect(viewer.query(".viewer-counter").textContent).toBe("slide 3 / 4");
  });

  it("draws again after a render that failed instead of stalling", async () => {
    const fake = fakeLibrary(2);
    let failed = false;
    const failing: PdfLibrary<PdfViewport> = {
      getDocument: (params) => {
        const task = fake.library.getDocument(params);
        return {
          ...task,
          promise: task.promise.then((pdf) => ({
            numPages: pdf.numPages,
            // The first page fails once, as a corrupt object does, then draws.
            getPage: (number) => {
              if (failed) return pdf.getPage(number);
              failed = true;
              return Promise.reject(new Error("broken page"));
            },
          })),
        };
      },
    };
    const host = document.createElement("div");
    const opening = createViewer(failing, host, options());
    await expect(opening).rejects.toThrow("broken page");
    host.querySelector<HTMLButtonElement>(".viewer-zoom-in")?.click();
    await fake.paint();
    expect(fake.rendered.map((render) => render.page)).toEqual([1]);
    expect(fake.rendered.at(-1)?.scale).toBe(1.25);
  });

  it("closes by emptying the host and releasing the document", async () => {
    const viewer = await open(1, false);
    expect(viewer.query(".viewer-counter").textContent).toBe("slide 1 / 1");
    viewer.handle.close();
    expect(viewer.host.innerHTML).toBe("");
    expect(viewer.destroyed()).toBe(1);
  });
});
