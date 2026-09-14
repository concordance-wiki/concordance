// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { readPins, wirePins, writePins, type PinsStorage } from "../../src/islands/pins.js";
import { PINS_STORAGE_KEY } from "../../src/pins.js";
import { renderSlot } from "../../src/render.js";
import type { PinnedPage, PinsProps } from "../../src/slots.js";
import { entityPage, header } from "../../src/gallery/fixtures.js";
import { defaultPinsLabels } from "../../src/theme/default/pins.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const rule: PinnedPage = {
  id: "specs/rules/publication-threshold",
  title: "Publication threshold",
};
const term: PinnedPage = { id: "glossary/keyword-page", title: "Keyword page" };
const screen: PinnedPage = { id: "specs/screens/pages/entity-page", title: "Entity page" };

function storage(
  initial: Record<string, string> = {},
): PinsStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const broken: PinsStorage = {
  getItem: () => {
    throw new Error("storage disabled");
  },
  setItem: () => {
    throw new Error("storage disabled");
  },
  removeItem: () => {
    throw new Error("storage disabled");
  },
};

/** The widths the browser would measure: the room of the list, every chip, the summary; every element of a class not listed measures nothing. */
interface Widths {
  list: number;
  chip: number;
  more: number;
  gap?: string;
}

function measuring(widths: Widths): {
  window: Parameters<typeof wirePins>[3];
  resize: () => void;
} {
  const listeners: (() => void)[] = [];
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList.contains("pin")) return widths.chip;
      if (this.classList.contains("pins-more")) return widths.more;
      return 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("pins-list") ? widths.list : 0;
    },
  });
  return {
    window: {
      addEventListener: (_type, listener) => {
        listeners.push(listener);
      },
      confirm: () => true,
      getComputedStyle: () => ({ columnGap: widths.gap ?? "10px" }),
    },
    resize: () => {
      for (const listener of listeners) listener();
    },
  };
}

/** The page: the island served empty in the header, the pin button hidden after the title, as the site serves them. */
function page(props: Partial<PinsProps> = {}, current: PinnedPage | null = term): HTMLElement {
  const pins: PinsProps = {
    base: "../../",
    labels: defaultPinsLabels,
    ...(current === null ? {} : { current }),
    ...props,
  };
  document.body.innerHTML =
    renderSlot("Header", { ...header, pins }, defaultTheme) +
    `<main>${renderSlot("EntityPage", entityPage, defaultTheme)}</main>`;
  const island = document.querySelector<HTMLElement>('concordance-island[data-island="pins"]');
  if (island === null) throw new Error("no pins island");
  return island;
}

const rows = (): string[] =>
  [...document.querySelectorAll<HTMLElement>(".pins-list > .pin")].map(
    (chip) => `${chip.hidden ? "hidden " : ""}${chip.querySelector("a")?.textContent ?? ""}`,
  );

describe("Pinned pages: chosen by the reader, kept in the browser, drawn as a row under the bar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("reads the stored pins and treats an unreadable storage as none; writes them and removes the key when the last one goes", () => {
    expect(readPins(storage({ [PINS_STORAGE_KEY]: JSON.stringify({ entries: [rule] }) }))).toEqual([
      rule,
    ]);
    expect(readPins(storage())).toEqual([]);
    expect(readPins(broken)).toEqual([]);
    const store = storage();
    writePins(store, [rule, term]);
    expect(store.items.get(PINS_STORAGE_KEY)).toBe(JSON.stringify({ entries: [rule, term] }));
    writePins(store, []);
    expect(store.items.size).toBe(0);
    expect(() => {
      writePins(broken, [rule]);
    }).not.toThrow();
  });

  it("draws no row without a pin, reveals the button of the page unpressed, and pins the page at the end on a click", () => {
    const island = page();
    const store = storage({ [PINS_STORAGE_KEY]: JSON.stringify({ entries: [rule] }) });
    const { window } = measuring({ list: 1000, chip: 100, more: 60 });
    expect(wirePins(island, document, store, window)).toBe(true);
    const button = document.querySelector<HTMLButtonElement>(".pin-button");
    expect(button?.hidden).toBe(false);
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(button?.querySelector(".pin-button-label")?.textContent).toBe("Pin");
    expect(rows()).toEqual(["Publication threshold"]);
    expect(document.querySelector(".pin-current")).toBeNull();
    button?.click();
    expect(rows()).toEqual(["Publication threshold", "Keyword page"]);
    expect(document.querySelector(".pin-current > a")?.textContent).toBe("Keyword page");
    expect(document.querySelector(".pin-current > a")?.getAttribute("aria-current")).toBe("page");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(button?.querySelector(".pin-button-label")?.textContent).toBe("Pinned");
    expect(document.querySelector(".pins-count")?.textContent).toBe("2 pinned");
    expect(store.items.get(PINS_STORAGE_KEY)).toBe(JSON.stringify({ entries: [rule, term] }));
    button?.click();
    expect(rows()).toEqual(["Publication threshold"]);
    expect(button?.getAttribute("aria-pressed")).toBe("false");
  });

  it("removes a pin on its cross, from the bar or from the menu, the menu staying open, and empties the row when the last one goes", () => {
    const island = page();
    const store = storage({
      [PINS_STORAGE_KEY]: JSON.stringify({ entries: [rule, term, screen] }),
    });
    const { window } = measuring({ list: 240, chip: 100, more: 60 });
    wirePins(island, document, store, window);
    expect(rows()).toEqual(["Publication threshold", "Keyword page", "hidden Entity page"]);
    const more = document.querySelector<HTMLDetailsElement>(".pins-more");
    expect(more?.hidden).toBe(false);
    expect(document.querySelector(".pins-more-count")?.textContent).toBe("+1");
    if (more !== null) more.open = true;
    document
      .querySelector<HTMLElement>('.pins-row .pin-remove[data-id="glossary/keyword-page"]')
      ?.click();
    expect(rows()).toEqual(["Publication threshold", "Entity page"]);
    expect(document.querySelector<HTMLDetailsElement>(".pins-more")?.hidden).toBe(true);
    expect(document.querySelector<HTMLDetailsElement>(".pins-more")?.open).toBe(false);
    expect(document.querySelector(".pin-button")?.getAttribute("aria-pressed")).toBe("false");
    document
      .querySelector<HTMLElement>(
        '.pins-list .pin-remove[data-id="specs/rules/publication-threshold"]',
      )
      ?.click();
    expect(rows()).toEqual(["Entity page"]);
    expect(store.items.get(PINS_STORAGE_KEY)).toBe(JSON.stringify({ entries: [screen] }));
    document.querySelector<HTMLElement>(".pins-list .pin-remove")?.click();
    expect(island.innerHTML).toBe("");
    expect(store.items.size).toBe(0);
  });

  it("folds the pins beyond the room of the bar behind the summary, keeps the menu open across a removal that still leaves some folded, and refits them when the window resizes", () => {
    const island = page();
    const store = storage({
      [PINS_STORAGE_KEY]: JSON.stringify({
        entries: [rule, term, screen, { id: "a/b", title: "B" }],
      }),
    });
    const widths: Widths = { list: 160, chip: 100, more: 60 };
    const { window, resize } = measuring(widths);
    wirePins(island, document, store, window);
    expect(rows()).toEqual([
      "Publication threshold",
      "hidden Keyword page",
      "hidden Entity page",
      "hidden B",
    ]);
    expect(document.querySelector(".pins-more-count")?.textContent).toBe("+3");
    const more = document.querySelector<HTMLDetailsElement>(".pins-more");
    if (more !== null) more.open = true;
    document
      .querySelector<HTMLElement>('.pins-row .pin-remove[data-id="glossary/keyword-page"]')
      ?.click();
    expect(rows()).toEqual(["Publication threshold", "hidden Entity page", "hidden B"]);
    expect(document.querySelector(".pins-more-count")?.textContent).toBe("+2");
    expect(document.querySelector<HTMLDetailsElement>(".pins-more")?.open).toBe(true);
    widths.list = 330;
    resize();
    expect(rows()).toEqual(["Publication threshold", "Entity page", "B"]);
    expect(document.querySelector<HTMLDetailsElement>(".pins-more")?.hidden).toBe(true);
    expect(document.querySelector<HTMLDetailsElement>(".pins-more")?.open).toBe(false);
    widths.list = 0;
    widths.gap = "none";
    resize();
    expect(rows()).toEqual(["hidden Publication threshold", "hidden Entity page", "hidden B"]);
    expect(document.querySelector<HTMLDetailsElement>(".pins-more")?.hidden).toBe(false);
    expect(document.querySelector(".pins-more-count")?.textContent).toBe("+3");
    // A row another script stripped of its summary is left as it is.
    document.querySelector(".pins-more")?.remove();
    widths.list = 1000;
    resize();
    expect(rows()).toEqual(["hidden Publication threshold", "hidden Entity page", "hidden B"]);
  });

  it("filters the rows of the menu as the reader types, on the title and the space, and removes every pin after a confirmation only", () => {
    const island = page();
    const store = storage({
      [PINS_STORAGE_KEY]: JSON.stringify({ entries: [rule, term, screen] }),
    });
    let confirmed = false;
    const asked: string[] = [];
    const { window } = measuring({ list: 1000, chip: 100, more: 60 });
    window.confirm = (message) => {
      asked.push(message);
      return confirmed;
    };
    wirePins(island, document, store, window);
    const filter = document.querySelector<HTMLInputElement>(".pins-filter");
    if (filter === null) throw new Error("no filter");
    filter.value = "specs";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const shown = (): string[] =>
      [...document.querySelectorAll<HTMLElement>(".pins-row")]
        .filter((row) => !row.hidden)
        .map((row) => row.querySelector("a")?.textContent ?? "");
    expect(shown()).toEqual(["Publication threshold", "Entity page"]);
    filter.value = "";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    expect(shown()).toEqual(["Publication threshold", "Keyword page", "Entity page"]);
    // A change of another control of the menu is not a filter.
    document.querySelector(".pins-menu-head")?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(shown()).toEqual(["Publication threshold", "Keyword page", "Entity page"]);
    document.querySelector<HTMLElement>(".pins-remove-all")?.click();
    expect(asked).toEqual(["Remove every pinned page?"]);
    expect(rows()).toHaveLength(3);
    confirmed = true;
    document.querySelector<HTMLElement>(".pins-remove-all")?.click();
    expect(island.innerHTML).toBe("");
    expect(store.items.size).toBe(0);
    // A click elsewhere in the row changes nothing.
    island.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(island.innerHTML).toBe("");
  });

  it("shows the row without a button on a page that is no entity, and leaves a preview island and an island without props alone", () => {
    const island = page({}, null);
    const store = storage({ [PINS_STORAGE_KEY]: JSON.stringify({ entries: [rule] }) });
    const { window } = measuring({ list: 1000, chip: 100, more: 60 });
    expect(wirePins(island, document, store, window)).toBe(true);
    expect(rows()).toEqual(["Publication threshold"]);
    expect(document.querySelector<HTMLButtonElement>(".pin-button")?.hidden).toBe(true);
    const preview = page({ pinned: [rule, term] });
    const before = preview.innerHTML;
    expect(before).toContain('<div class="pins-preview"><nav class="pins"');
    expect(wirePins(preview, document, store, window)).toBe(false);
    expect(preview.innerHTML).toBe(before);
    const bare = document.createElement("concordance-island");
    expect(wirePins(bare, document, store, window)).toBe(false);
    expect(bare.innerHTML).toBe("");
  });

  it("keeps the row and the button working when storage refuses to remember, and a resize without a row measures nothing", () => {
    const island = page();
    const { window, resize } = measuring({ list: 1000, chip: 100, more: 60 });
    wirePins(island, document, broken, window);
    expect(island.innerHTML).toBe("");
    resize();
    expect(island.innerHTML).toBe("");
    document.querySelector<HTMLElement>(".pin-button")?.click();
    expect(rows()).toEqual(["Keyword page"]);
  });

  it("wires the button of a page whose header has no label element", () => {
    const island = page();
    document.querySelector(".pin-button-label")?.remove();
    const { window } = measuring({ list: 1000, chip: 100, more: 60 });
    wirePins(island, document, storage(), window);
    document.querySelector<HTMLElement>(".pin-button")?.click();
    expect(document.querySelector(".pin-button")?.getAttribute("aria-pressed")).toBe("true");
    expect(rows()).toEqual(["Keyword page"]);
  });
});
