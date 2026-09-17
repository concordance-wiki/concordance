// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { corporateMeetingPage } from "../../src/gallery/fixtures.js";
import {
  TAB_SHOWN_EVENT,
  TABS_SCRIPTED,
  wireTabs,
  type TabsWindow,
} from "../../src/islands/tabs.js";
import { renderSlot } from "../../src/render.js";
import { defaultTheme } from "../../src/theme/resolve.js";

/** A window double: the fragment as given, its replacements recorded, the hashchange listener kept to be fired. */
function fakeWindow(hash = ""): TabsWindow & { replaced: string[]; fire: () => void } {
  const listeners: (() => void)[] = [];
  const win = {
    location: { hash },
    history: {
      replaceState: (_data: unknown, _unused: string, url: string) => {
        win.replaced.push(url);
        win.location.hash = url;
      },
    },
    addEventListener: (_type: "hashchange", listener: () => void) => {
      listeners.push(listener);
    },
    replaced: [] as string[],
    fire: () => {
      for (const listener of listeners) listener();
    },
  };
  return win;
}

/** The meeting page served, its row of tabs, its tabs and its panels; the shown events counted per panel. */
function served(hash = ""): {
  island: Element;
  tabs: HTMLElement[];
  panels: HTMLElement[];
  shown: string[];
  win: ReturnType<typeof fakeWindow>;
} {
  document.body.innerHTML = renderSlot("EntityPage", corporateMeetingPage, defaultTheme);
  const island = document.querySelector('concordance-island[data-island="tabs"]');
  if (island === null) throw new Error("the meeting page carries a row of tabs");
  const tabs = [...island.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panels = [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  const shown: string[] = [];
  for (const panel of panels) {
    panel.addEventListener(TAB_SHOWN_EVENT, () => {
      shown.push(panel.id);
    });
  }
  return { island, tabs, panels, shown, win: fakeWindow(hash) };
}

const selected = (tabs: HTMLElement[]): string[] =>
  tabs.map(
    (tab) => `${tab.getAttribute("aria-selected") ?? ""}/${tab.getAttribute("tabindex") ?? ""}`,
  );
const hidden = (panels: HTMLElement[]): boolean[] => panels.map((panel) => panel.hidden !== false);

describe("the tabs island", () => {
  it("serves the tabs as anchors following the tablist pattern, the first one selected, no tabindex forced", () => {
    const { tabs, panels } = served();
    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual([
      "#representation-transcript",
      "#representation-notes",
      "#representation-deck",
    ]);
    expect(selected(tabs)).toEqual(["true/", "false/", "false/"]);
    expect(panels.map((panel) => panel.getAttribute("aria-labelledby"))).toEqual(
      tabs.map((tab) => tab.id),
    );
    expect(hidden(panels)).toEqual([false, false, false]);
  });

  it("drives the panels once wired: the first one shown, the others hidden, the block marked, the tab of the panel shown selected and the only one in the tab order", () => {
    const { island, tabs, panels, shown, win } = served();
    expect(wireTabs(island, document, win)).toBe(true);
    expect(island.closest(".tabs")?.classList.contains(TABS_SCRIPTED)).toBe(true);
    expect(hidden(panels)).toEqual([false, true, true]);
    expect(selected(tabs)).toEqual(["true/0", "false/-1", "false/-1"]);
    expect(shown).toEqual(["representation-transcript"]);
    expect(win.replaced).toEqual([]);
  });

  it("opens on the panel the fragment names, or the one holding the anchor it names, the first one for a fragment outside the panels or naming nothing", () => {
    const deck = served("#representation-deck");
    wireTabs(deck.island, document, deck.win);
    expect(hidden(deck.panels)).toEqual([true, true, false]);
    expect(deck.shown).toEqual(["representation-deck"]);
    const cue = served("#L4-2");
    wireTabs(cue.island, document, cue.win);
    expect(hidden(cue.panels)).toEqual([false, true, true]);
    const notes = served("#notes");
    wireTabs(notes.island, document, notes.win);
    expect(hidden(notes.panels)).toEqual([true, false, true]);
    const outside = served("#meeting-properties");
    wireTabs(outside.island, document, outside.win);
    expect(hidden(outside.panels)).toEqual([false, true, true]);
    const nothing = served("#nowhere");
    wireTabs(nothing.island, document, nothing.win);
    expect(hidden(nothing.panels)).toEqual([false, true, true]);
  });

  it("shows the panel of a tab followed, selects the tab and writes its id in the address without following the anchor", () => {
    const { island, tabs, panels, shown, win } = served();
    wireTabs(island, document, win);
    const click = new MouseEvent("click", { cancelable: true, bubbles: true });
    tabs[2]?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(hidden(panels)).toEqual([true, true, false]);
    expect(selected(tabs)).toEqual(["false/-1", "false/-1", "true/0"]);
    expect(win.replaced).toEqual(["#representation-deck"]);
    expect(shown).toEqual(["representation-transcript", "representation-deck"]);
  });

  it("moves the selection with the arrow keys around the row and with Home and End to its ends, focusing the tab reached, and leaves the other keys alone", () => {
    const { island, tabs, panels, win } = served();
    wireTabs(island, document, win);
    const press = (tab: HTMLElement | undefined, key: string): boolean => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true });
      tab?.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press(tabs[0], "ArrowRight")).toBe(true);
    expect(hidden(panels)).toEqual([true, false, true]);
    expect(document.activeElement).toBe(tabs[1]);
    expect(press(tabs[1], "ArrowLeft")).toBe(true);
    expect(hidden(panels)).toEqual([false, true, true]);
    expect(press(tabs[0], "ArrowLeft")).toBe(true);
    expect(hidden(panels)).toEqual([true, true, false]);
    expect(press(tabs[2], "ArrowRight")).toBe(true);
    expect(hidden(panels)).toEqual([false, true, true]);
    expect(press(tabs[0], "End")).toBe(true);
    expect(hidden(panels)).toEqual([true, true, false]);
    expect(press(tabs[2], "Home")).toBe(true);
    expect(hidden(panels)).toEqual([false, true, true]);
    expect(document.activeElement).toBe(tabs[0]);
    expect(press(tabs[0], "Tab")).toBe(false);
    expect(press(tabs[0], "Enter")).toBe(false);
    expect(hidden(panels)).toEqual([false, true, true]);
    expect(win.replaced).toEqual([
      "#representation-notes",
      "#representation-transcript",
      "#representation-deck",
      "#representation-transcript",
      "#representation-deck",
      "#representation-transcript",
    ]);
  });

  it("follows a fragment that names an anchor inside a panel to that panel and scrolls to the anchor, and ignores one naming nothing of the panels", () => {
    const { island, panels, win } = served();
    wireTabs(island, document, win);
    const scrolled: string[] = [];
    // The test document lays nothing out: the scroll is observed on the prototype.
    const spy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(function scrollIntoView(this: Element) {
        scrolled.push(this.id);
      });
    try {
      win.location.hash = "#L4";
      win.fire();
      expect(hidden(panels)).toEqual([true, true, false]);
      expect(scrolled).toEqual(["L4"]);
      win.location.hash = "#meeting-properties";
      win.fire();
      expect(hidden(panels)).toEqual([true, true, false]);
      win.location.hash = "";
      win.fire();
      expect(scrolled).toEqual(["L4"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("wires nothing for a row outside a tabs block, without any tab, or whose panel is missing", () => {
    const { island, tabs, win } = served();
    const spy = vi.spyOn(win, "addEventListener");
    const block = island.closest(".tabs");
    document.body.append(island);
    expect(wireTabs(island, document, win)).toBe(false);
    block?.append(island);
    tabs[1]?.setAttribute("aria-controls", "nowhere");
    expect(wireTabs(island, document, win)).toBe(false);
    tabs[1]?.removeAttribute("aria-controls");
    expect(wireTabs(island, document, win)).toBe(false);
    for (const tab of tabs) tab.remove();
    expect(wireTabs(island, document, win)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(block?.classList.contains(TABS_SCRIPTED)).toBe(false);
  });
});
