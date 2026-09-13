// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { documentEntityPage } from "../../src/gallery/fixtures.js";
import { renderSlot } from "../../src/render.js";
import { viewerLabels } from "../../src/theme/default/document-viewer.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const pdfjs = vi.hoisted(() => ({
  requested: [] as unknown[],
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: pdfjs.GlobalWorkerOptions,
  getDocument: (params: unknown) => {
    pdfjs.requested.push(params);
    return {
      promise: Promise.resolve({
        numPages: 1,
        getPage: () =>
          Promise.resolve({
            getViewport: () => ({ width: 10, height: 10 }),
            render: () => ({ promise: Promise.resolve() }),
          }),
      }),
      destroy: () => Promise.resolve(),
    };
  },
}));

describe("the viewer-pdf entry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("points pdf.js at the worker bundle, resolved against the page, then opens the PDF in the host", async () => {
    const { openViewer } = await import("../../src/islands/viewer-pdf.client.js");
    const host = document.createElement("div");
    document.body.append(host);
    const handle = await openViewer(host, {
      pdfHref: "meetings/threshold-review.pdf",
      workerHref: "../../assets/viewer-pdf-worker-00000000.js",
      labels: viewerLabels("page"),
      positions: [],
    });
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe(
      new URL("../../assets/viewer-pdf-worker-00000000.js", document.baseURI).href,
    );
    expect(pdfjs.requested).toEqual([{ url: "meetings/threshold-review.pdf" }]);
    expect(host.querySelector("canvas")).not.toBeNull();
    handle.close();
    expect(host.innerHTML).toBe("");
  });
});

describe("the document-viewer entry", () => {
  it("wires every document island of the page with a dynamic import of the viewer resolved against the page", async () => {
    document.body.innerHTML = renderSlot("EntityPage", documentEntityPage, defaultTheme);
    await import("../../src/islands/document-viewer.client.js");
    const button = document.querySelector<HTMLButtonElement>("button.document-open");
    expect(button?.hidden).toBe(false);
    // The hashed bundle of the fixture does not exist: the import fails and the reader gets the PDF link.
    button?.click();
    await vi.waitFor(() => {
      expect(document.querySelector(".document-unavailable")).not.toBeNull();
    });
    expect(document.querySelector(".document-unavailable a")?.getAttribute("href")).toBe(
      "meetings/threshold-review.pdf",
    );
  });
});
