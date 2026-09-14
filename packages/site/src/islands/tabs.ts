/** The class the island sets on the block once it drives the panels, so that the stylesheet stops showing them by target. */
export const TABS_SCRIPTED = "tabs-scripted";

/** The event the island dispatches on a panel it shows, so that what the panel holds can wake up. */
export const TAB_SHOWN_EVENT = "concordance:tabshow";

/** The keys of the tablist pattern: the arrows move the selection, Home and End jump to the ends. */
const KEYS: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index + count - 1) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

/** What the island needs from the window: the fragment, its silent replacement, and the changes of the fragment. */
export interface TabsWindow {
  location: { hash: string };
  history: { replaceState(data: unknown, unused: string, url: string): void };
  addEventListener(type: "hashchange", listener: () => void): void;
}

/**
 * Drives one row of tabs: the panel shown is the one the fragment of the address names, or the
 * one holding the element it names, else the first; following a tab shows its panel, marks it
 * selected and writes its id in the address without scrolling; the arrow keys move the
 * selection along the row, Home and End to its ends; a fragment naming an anchor inside a
 * panel, followed from the page, shows that panel and scrolls to the anchor. A panel shown
 * receives the `concordance:tabshow` event. Nothing is wired for a row without a panel.
 */
export function wireTabs(element: Element, doc: Document, win: TabsWindow): boolean {
  const block = element.closest(".tabs");
  const tabs = [...element.querySelectorAll<HTMLElement>('[role="tab"]')];
  const shown = tabs.flatMap((tab) => {
    const panel = doc.getElementById(tab.getAttribute("aria-controls") ?? "");
    return panel === null ? [] : [panel];
  });
  if (block === null || shown.length === 0 || shown.length !== tabs.length) return false;
  const indexOf = (hash: string): number | undefined => {
    const id = hash.slice(1);
    if (id === "") return undefined;
    const target = doc.getElementById(id);
    const index = shown.findIndex((panel) => panel === target || panel.contains(target));
    return index === -1 ? undefined : index;
  };
  const select = (index: number): void => {
    tabs.forEach((tab, at) => {
      tab.setAttribute("aria-selected", at === index ? "true" : "false");
      tab.setAttribute("tabindex", at === index ? "0" : "-1");
    });
    shown.forEach((panel, at) => {
      panel.hidden = at !== index;
    });
    shown[index]?.dispatchEvent(new Event(TAB_SHOWN_EVENT));
  };
  const follow = (index: number): void => {
    select(index);
    for (const panel of shown.slice(index, index + 1)) {
      win.history.replaceState(null, "", `#${panel.id}`);
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      follow(index);
    });
    tab.addEventListener("keydown", (event) => {
      const move = KEYS[event.key];
      if (move === undefined) return;
      event.preventDefault();
      const next = move(index, tabs.length);
      follow(next);
      tabs[next]?.focus();
    });
  });
  win.addEventListener("hashchange", () => {
    const index = indexOf(win.location.hash);
    if (index === undefined) return;
    select(index);
    doc.getElementById(win.location.hash.slice(1))?.scrollIntoView();
  });
  block.classList.add(TABS_SCRIPTED);
  select(indexOf(win.location.hash) ?? 0);
  return true;
}
