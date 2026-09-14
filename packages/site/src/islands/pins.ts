import {
  filterPins,
  fitCount,
  isPinned,
  parsePins,
  PINS_STORAGE_KEY,
  pinPage,
  pinsMarkup,
  pinsValue,
  unpinPage,
} from "../pins.js";
import type { PinnedPage, PinsProps } from "../slots.js";

/** The part of `localStorage` the pins use; every call may throw when storage is disabled. */
export interface PinsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What the island needs from the window: the resize to refit the bar, the confirmation before removing everything, the gap of the row. */
export interface PinsWindow {
  addEventListener(type: "resize", listener: () => void): void;
  confirm(message: string): boolean;
  getComputedStyle(element: Element): { columnGap: string };
}

/** The pinned pages stored, in their order; none when nothing valid is stored or storage cannot be read. */
export function readPins(storage: PinsStorage): PinnedPage[] {
  try {
    return parsePins(storage.getItem(PINS_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Stores the pinned pages, the key removed when none is left; a failing storage is ignored, the row still lives in the page. */
export function writePins(storage: PinsStorage, entries: readonly PinnedPage[]): void {
  try {
    const value = pinsValue(entries);
    if (value === undefined) {
      storage.removeItem(PINS_STORAGE_KEY);
    } else {
      storage.setItem(PINS_STORAGE_KEY, value);
    }
  } catch {
    // Storage disabled: the pins hold for this page only.
  }
}

/** Measures the chips against the room the list has beside the summary of the others, and hides the chips beyond it. */
function measure(nav: HTMLElement, window: PinsWindow): void {
  const list = nav.querySelector<HTMLElement>(".pins-list");
  const more = nav.querySelector<HTMLElement>(".pins-more");
  const count = nav.querySelector<HTMLElement>(".pins-more-count");
  if (list === null || more === null || count === null) {
    return;
  }
  const chips = [...list.querySelectorAll<HTMLElement>(".pin")];
  for (const chip of chips) {
    chip.hidden = false;
  }
  more.hidden = false;
  const gap = Number.parseFloat(window.getComputedStyle(list).columnGap);
  const shown = fitCount(
    chips.map((chip) => chip.offsetWidth),
    list.clientWidth,
    more.offsetWidth,
    Number.isNaN(gap) ? 0 : gap,
  );
  for (const [index, chip] of chips.entries()) {
    chip.hidden = index >= shown;
  }
  more.hidden = shown === chips.length;
  if (more.hidden) {
    more.removeAttribute("open");
  }
  count.textContent = `+${String(chips.length - shown)}`;
}

/**
 * Draws the row of pins under the bar and keeps it: the pins the reader chose, in the order
 * they were pinned, the current page marked, each with the cross that removes it; the ones
 * beyond the room of the bar behind a "+N" summary opening the full list, with a filter and
 * the removal of every pin, confirmed. The button of the page header pins the page and unpins
 * it, worded in the language of the site. Nothing is fetched and nothing leaves the browser:
 * the pins live in `localStorage` and survive a reload, a new tab and a new session. An island
 * served with a row is a preview: it is left as it is.
 */
export function wirePins(
  element: HTMLElement,
  document: ParentNode,
  storage: PinsStorage,
  window: PinsWindow,
): boolean {
  if (element.firstElementChild !== null) {
    return false;
  }
  // Written by island() at build: the attribute carries the props of the island.
  const props = JSON.parse(element.getAttribute("data-props") ?? "null") as PinsProps | null;
  if (props === null) {
    return false;
  }
  const { base, current, labels } = props;
  const button = current === undefined ? null : document.querySelector<HTMLElement>(".pin-button");
  let entries = readPins(storage);
  const render = (): void => {
    const wasOpen = element.querySelector<HTMLDetailsElement>(".pins-more")?.open === true;
    element.innerHTML = pinsMarkup({ base, current: current?.id, entries, labels });
    const nav = element.querySelector<HTMLElement>(".pins");
    if (nav !== null) {
      measure(nav, window);
      // The menu stays open across a removal made from it, as long as the bar still folds some pins.
      const more = nav.querySelector<HTMLDetailsElement>(".pins-more");
      if (more !== null && !more.hidden) {
        more.open = wasOpen;
      }
    }
    if (button !== null && current !== undefined) {
      const pinned = isPinned(entries, current.id);
      button.setAttribute("aria-pressed", pinned ? "true" : "false");
      const label = button.querySelector(".pin-button-label");
      if (label !== null) {
        label.textContent = pinned ? labels.pinned : labels.pin;
      }
    }
  };
  const update = (next: PinnedPage[]): void => {
    entries = next;
    writePins(storage, entries);
    render();
  };
  element.addEventListener("click", (event) => {
    // The target of a click is the element clicked, which has `closest`.
    const origin = event.target as Element;
    const remove = origin.closest(".pin-remove");
    if (remove !== null) {
      update(unpinPage(entries, remove.getAttribute("data-id")));
      return;
    }
    if (origin.closest(".pins-remove-all") !== null && window.confirm(labels.confirmRemoveAll)) {
      update([]);
    }
  });
  element.addEventListener("input", (event) => {
    // The only field of the row is the filter of the menu.
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const kept = new Set(filterPins(entries, event.target.value).map((entry) => entry.id));
    for (const row of element.querySelectorAll<HTMLElement>(".pins-row")) {
      row.hidden = !kept.has(String(row.dataset["id"]));
    }
  });
  if (button !== null && current !== undefined) {
    button.addEventListener("click", () => {
      update(
        isPinned(entries, current.id) ? unpinPage(entries, current.id) : pinPage(entries, current),
      );
    });
    button.hidden = false;
  }
  window.addEventListener("resize", () => {
    const nav = element.querySelector<HTMLElement>(".pins");
    if (nav !== null) {
      measure(nav, window);
    }
  });
  render();
  return true;
}
