// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import {
  positionsOf,
  wireDocumentViewer,
  type ViewerHandle,
  type ViewerModule,
  type ViewerOptions,
} from "../../src/islands/document-viewer.js";
import { documentEntityPage, documentPageCorporate } from "../../src/gallery/fixtures.js";
import { renderSlot } from "../../src/render.js";
import { defaultTheme } from "../../src/theme/resolve.js";

/** The document page as served, mounted in the test document. */
function mount(): { island: HTMLElement; section: HTMLElement } {
  document.body.innerHTML = renderSlot("EntityPage", documentEntityPage, defaultTheme);
  const island = document.querySelector<HTMLElement>(
    'concordance-island[data-island="document-viewer"]',
  );
  const section = island?.closest<HTMLElement>("section.document");
  if (island === null || section === null || section === undefined) {
    throw new Error("the fixture carries one document island");
  }
  return { island, section };
}

/** A viewer module double that records what it was asked and hands back a handle. */
function fakeModule(fail = false) {
  const opened: { host: HTMLElement; options: ViewerOptions }[] = [];
  const shown: number[] = [];
  const handle: ViewerHandle = {
    goTo: (number) => {
      shown.push(number);
      opened[0]?.options.onPage?.(number);
    },
    close: () => undefined,
  };
  const module: ViewerModule = {
    openViewer: (host, options) => {
      if (fail) return Promise.reject(new Error("no canvas"));
      opened.push({ host, options });
      host.append("viewer");
      return Promise.resolve(handle);
    },
  };
  return { module, opened, shown };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("the document viewer island", () => {
  it("reveals the button, imports the viewer bundle on the first click only and opens it on the PDF with the positions read from the page", async () => {
    const { island, section } = mount();
    const imported: string[] = [];
    const fake = fakeModule();
    expect(
      wireDocumentViewer(island, {
        importViewer: (href) => {
          imported.push(href);
          return Promise.resolve(fake.module);
        },
      }),
    ).toBe(true);
    const button = island.querySelector<HTMLButtonElement>("button.document-open");
    const container = island.querySelector<HTMLElement>(".document-viewer");
    expect(button?.hidden).toBe(false);
    expect(button?.textContent).toBe("Open the viewer");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(container?.hidden).toBe(true);
    expect(imported).toEqual([]);

    button?.click();
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe("Loading the viewer");
    // A second click while the bundle loads, however it is dispatched, starts nothing.
    button?.dispatchEvent(new Event("click"));
    await tick();
    expect(imported).toEqual(["../../../assets/viewer-pdf-00000000.js"]);
    expect(fake.opened).toHaveLength(1);
    expect(fake.opened[0]?.host).toBe(container);
    expect(fake.opened[0]?.options).toMatchObject({
      pdfHref: "meetings/threshold-review.pdf",
      workerHref: "../../../assets/viewer-pdf-worker-00000000.js",
      labels: { openViewer: "Open the viewer", unit: "slide" },
    });
    expect(fake.opened[0]?.options.positions).toEqual(positionsOf(section));
    expect(positionsOf(section).map((position) => [position.number, position.text])).toEqual([
      [1, "Keyword page threshold review"],
      [2, "Three occurrences in two files: the publication threshold as the rule states it."],
      [3, ""],
      [4, "Build summary: keyword pages and discarded expressions."],
    ]);
    expect(container?.hidden).toBe(false);
    expect(container?.textContent).toBe("viewer");
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toBe("Close the viewer");
    expect(button?.getAttribute("aria-expanded")).toBe("true");

    // Afterwards the button toggles the viewer without importing again.
    button?.click();
    expect(container?.hidden).toBe(true);
    expect(button?.textContent).toBe("Open the viewer");
    button?.click();
    expect(container?.hidden).toBe(false);
    expect(imported).toHaveLength(1);
  });

  it("makes the rail follow the page shown and jump the viewer to the slide clicked, the anchor of the text no longer followed", async () => {
    const { island, section } = mount();
    const fake = fakeModule();
    wireDocumentViewer(island, { importViewer: () => Promise.resolve(fake.module) });
    const entries = [...section.querySelectorAll<HTMLElement>(".document-rail a[data-position]")];
    const click = (entry: HTMLElement | undefined): boolean => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      entry?.dispatchEvent(event);
      return event.defaultPrevented;
    };
    // Before the viewer runs, a rail entry is a plain anchor to the text.
    expect(click(entries[1])).toBe(false);
    expect(fake.shown).toEqual([]);
    island.querySelector<HTMLButtonElement>("button.document-open")?.click();
    await tick();
    fake.opened[0]?.options.onPage?.(2);
    expect(entries.map((entry) => entry.classList.contains("current"))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(entries[1]?.getAttribute("aria-current")).toBe("true");
    expect(entries[0]?.getAttribute("aria-current")).toBeNull();
    expect(click(entries[3])).toBe(true);
    expect(fake.shown).toEqual([4]);
    expect(entries[3]?.classList.contains("current")).toBe(true);
    expect(entries[1]?.classList.contains("current")).toBe(false);
  });

  it("opens the viewer at once on the document page, the button never shown, the strip of pages driving it", async () => {
    document.body.innerHTML = renderSlot("EntityPage", documentPageCorporate, defaultTheme);
    const island = document.querySelector<HTMLElement>(
      'concordance-island[data-island="document-viewer"]',
    );
    const page = island?.closest<HTMLElement>(".document-page");
    if (island === null || page === null || page === undefined) {
      throw new Error("the document page carries one document island");
    }
    const imported: string[] = [];
    const fake = fakeModule();
    expect(
      wireDocumentViewer(island, {
        importViewer: (href) => {
          imported.push(href);
          return Promise.resolve(fake.module);
        },
      }),
    ).toBe(true);
    const button = island.querySelector<HTMLButtonElement>("button.document-open");
    const container = island.querySelector<HTMLElement>(".document-viewer");
    expect(button?.hidden).toBe(true);
    expect(imported).toEqual(["../../../assets/viewer-pdf-00000000.js"]);
    await tick();
    expect(button?.hidden).toBe(true);
    expect(container?.hidden).toBe(false);
    expect(fake.opened[0]?.options.positions).toHaveLength(24);
    expect(fake.opened[0]?.options.positions[0]).toEqual({
      number: 1,
      text: "Transcript publication framing",
    });
    const entries = [...page.querySelectorAll<HTMLElement>(".document-rail a[data-position]")];
    expect(entries).toHaveLength(24);
    entries[6]?.click();
    expect(fake.shown).toEqual([7]);
    expect(entries[6]?.getAttribute("aria-current")).toBe("true");
    expect(entries[0]?.getAttribute("aria-current")).toBeNull();
  });

  it("falls back to the link to the PDF on the document page too when the bundle cannot be imported", async () => {
    document.body.innerHTML = renderSlot("EntityPage", documentPageCorporate, defaultTheme);
    const island = document.querySelector<HTMLElement>(
      'concordance-island[data-island="document-viewer"]',
    );
    if (island === null) throw new Error("the document page carries one document island");
    wireDocumentViewer(island, { importViewer: () => Promise.reject(new Error("file://")) });
    await tick();
    expect(island.querySelector<HTMLButtonElement>("button.document-open")?.hidden).toBe(true);
    expect(island.querySelector(".document-unavailable")?.textContent).toBe(
      "The viewer could not be loaded. Open the PDF",
    );
  });

  it("falls back to a link to the PDF when the bundle cannot be imported, as over file:// in some browsers", async () => {
    const { island } = mount();
    wireDocumentViewer(island, { importViewer: () => Promise.reject(new Error("CORS")) });
    const button = island.querySelector<HTMLButtonElement>("button.document-open");
    button?.click();
    await tick();
    expect(button?.hidden).toBe(true);
    const notice = island.querySelector<HTMLElement>(".document-viewer p.document-unavailable");
    expect(notice?.getAttribute("role")).toBe("status");
    expect(notice?.textContent).toBe("The viewer could not be loaded. Open the PDF");
    expect(notice?.querySelector("a")?.getAttribute("href")).toBe("meetings/threshold-review.pdf");
    expect(island.querySelector<HTMLElement>(".document-viewer")?.hidden).toBe(false);
  });

  it("falls back the same way when the viewer itself fails to open the PDF", async () => {
    const { island } = mount();
    const fake = fakeModule(true);
    wireDocumentViewer(island, { importViewer: () => Promise.resolve(fake.module) });
    island.querySelector<HTMLButtonElement>("button.document-open")?.click();
    await tick();
    expect(island.querySelector(".document-unavailable")).not.toBeNull();
  });

  it("wires nothing on an element without the button, the container or the section around it", () => {
    const { island } = mount();
    const deps = { importViewer: () => Promise.reject(new Error("never")) };
    const loose = document.createElement("div");
    loose.innerHTML = island.innerHTML;
    expect(wireDocumentViewer(loose, deps)).toBe(false);
    island.querySelector(".document-viewer")?.remove();
    expect(wireDocumentViewer(island, deps)).toBe(false);
    island.querySelector("button")?.remove();
    expect(wireDocumentViewer(island, deps)).toBe(false);
  });

  it("reads a position without a text block as empty", () => {
    const section = document.createElement("section");
    section.innerHTML =
      '<div class="document-text"><details id="L9-2"><summary>page 9</summary></details></div>';
    expect(positionsOf(section)).toEqual([{ number: 9, text: "" }]);
  });

  it("wires nothing without the props the build writes", () => {
    const { island } = mount();
    island.removeAttribute("data-props");
    expect(
      wireDocumentViewer(island, { importViewer: () => Promise.reject(new Error("never")) }),
    ).toBe(false);
  });
});
