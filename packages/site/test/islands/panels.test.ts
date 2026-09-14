import { describe, expect, it } from "vitest";

import type { KeyEvent } from "../../src/islands/editable.js";
import {
  applyFolded,
  readFolded,
  toggleFolded,
  wirePanels,
  type HandleElement,
  type PanelsDocument,
  type PanelsRoot,
  type PanelStorage,
} from "../../src/islands/panels.js";
import { PANELS_STORAGE_KEY } from "../../src/panels.js";

function storage(
  initial: Record<string, string> = {},
): PanelStorage & { items: Map<string, string> } {
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

const broken: PanelStorage = {
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

interface FakeHandle extends HandleElement {
  attributes: Record<string, string>;
  name: { textContent: string | null } | null;
  click: () => void;
}

function handle(panel: string, withName = true): FakeHandle {
  const listeners: (() => void)[] = [];
  const name = withName ? { textContent: "Tree of the space" } : null;
  const fake: FakeHandle = {
    hidden: true,
    attributes: { "data-panel": panel, "aria-expanded": "true", title: "Fold or unfold" },
    name,
    getAttribute: (attribute) => fake.attributes[attribute] ?? null,
    setAttribute(attribute, value) {
      fake.attributes[attribute] = value;
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    querySelector: () => name,
    click: () => {
      for (const listener of listeners) listener();
    },
  };
  return fake;
}

interface FakeDocument extends PanelsDocument {
  /** Presses a key anywhere in the page; tells whether a listener claimed it. */
  press: (key: string, extra?: Partial<KeyEvent>) => boolean;
}

function documentOf(handles: HandleElement[]): FakeDocument {
  const listeners: ((event: KeyEvent) => void)[] = [];
  return {
    querySelectorAll: () => handles,
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    press(key, extra = {}) {
      let prevented = false;
      const event: KeyEvent = {
        key,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target: { tagName: "BODY" },
        preventDefault: () => {
          prevented = true;
        },
        ...extra,
      };
      for (const listener of listeners) listener(event);
      return prevented;
    },
  };
}

const props = JSON.stringify({
  labels: {
    fold: "Replier ou déplier",
    tree: "Arborescence de l’espace",
    panel: "Volet de droite",
  },
});

function element(serialised: string | null = props): { getAttribute: () => string | null } {
  return { getAttribute: () => serialised };
}

describe("Side panels folded behind their handles, remembered per reader", () => {
  it("reads the stored folded panels and treats anything else, or an unreadable storage, as every panel open", () => {
    expect(readFolded(storage({ [PANELS_STORAGE_KEY]: "tree panel" }))).toEqual(["tree", "panel"]);
    expect(readFolded(storage({ [PANELS_STORAGE_KEY]: "panel" }))).toEqual(["panel"]);
    expect(readFolded(storage({ [PANELS_STORAGE_KEY]: "drawer" }))).toEqual([]);
    expect(readFolded(storage())).toEqual([]);
    expect(readFolded(broken)).toEqual([]);
  });

  it("applies the folded panels to data-panels on the root and remembers them under the namespaced key, nothing stored when every panel is open", () => {
    const store = storage();
    const root: PanelsRoot = { dataset: {} };
    applyFolded(["tree"], store, root);
    expect(root.dataset.panels).toBe("tree");
    expect(store.items.get("concordance-panels")).toBe("tree");
    applyFolded(["panel", "tree"], store, root);
    expect(root.dataset.panels).toBe("tree panel");
    applyFolded([], store, root);
    expect(root.dataset).toEqual({});
    expect(store.items.size).toBe(0);
  });

  it("still changes the page when storage refuses to remember", () => {
    const root: PanelsRoot = { dataset: { panels: "tree" } };
    applyFolded(["panel"], broken, root);
    expect(root.dataset.panels).toBe("panel");
    applyFolded([], broken, root);
    expect(root.dataset.panels).toBeUndefined();
  });

  it("folds a panel that is open and unfolds one that is folded, the other left as it is", () => {
    expect(toggleFolded([], "tree")).toEqual(["tree"]);
    expect(toggleFolded(["tree"], "panel")).toEqual(["tree", "panel"]);
    expect(toggleFolded(["tree", "panel"], "tree")).toEqual(["panel"]);
    expect(toggleFolded(["panel"], "panel")).toEqual([]);
  });

  it("reveals the handles, names each panel in the language of the site with the title of the island, and announces the state read from storage", () => {
    const tree = handle("tree");
    const panel = handle("panel");
    const store = storage({ [PANELS_STORAGE_KEY]: "panel" });
    const root: PanelsRoot = { dataset: { panels: "panel" } };
    expect(wirePanels(element(), documentOf([tree, panel]), store, root)).toBe(2);
    expect(tree.hidden).toBe(false);
    expect(panel.hidden).toBe(false);
    expect(tree.attributes["aria-expanded"]).toBe("true");
    expect(panel.attributes["aria-expanded"]).toBe("false");
    expect(tree.name?.textContent).toBe("Arborescence de l’espace");
    expect(panel.name?.textContent).toBe("Volet de droite");
    expect(tree.attributes["title"]).toBe("Replier ou déplier");
    expect(panel.attributes["title"]).toBe("Replier ou déplier");
  });

  it("folds and unfolds a panel on a click of its handle, the root and the storage following", () => {
    const tree = handle("tree");
    const panel = handle("panel");
    const store = storage();
    const root: PanelsRoot = { dataset: {} };
    wirePanels(element(), documentOf([tree, panel]), store, root);
    tree.click();
    expect(tree.attributes["aria-expanded"]).toBe("false");
    expect(panel.attributes["aria-expanded"]).toBe("true");
    expect(root.dataset.panels).toBe("tree");
    expect(store.items.get(PANELS_STORAGE_KEY)).toBe("tree");
    panel.click();
    expect(root.dataset.panels).toBe("tree panel");
    tree.click();
    expect(tree.attributes["aria-expanded"]).toBe("true");
    expect(root.dataset.panels).toBe("panel");
    panel.click();
    expect(root.dataset).toEqual({});
    expect(store.items.size).toBe(0);
  });

  it("folds the tree on [ and the right panel on ], outside a field and without a modifier, and leaves every other key alone", () => {
    const tree = handle("tree");
    const panel = handle("panel");
    const document = documentOf([tree, panel]);
    const root: PanelsRoot = { dataset: {} };
    wirePanels(element(), document, storage(), root);
    expect(document.press("[")).toBe(true);
    expect(root.dataset.panels).toBe("tree");
    expect(document.press("]")).toBe(true);
    expect(root.dataset.panels).toBe("tree panel");
    expect(document.press("[")).toBe(true);
    expect(root.dataset.panels).toBe("panel");
    expect(document.press("/")).toBe(false);
    expect(document.press("]", { ctrlKey: true })).toBe(false);
    expect(document.press("]", { altKey: true })).toBe(false);
    expect(document.press("]", { metaKey: true })).toBe(false);
    expect(document.press("]", { target: { tagName: "INPUT" } })).toBe(false);
    expect(document.press("]", { target: { isContentEditable: true } })).toBe(false);
    expect(root.dataset.panels).toBe("panel");
  });

  it("ignores the key of a panel the page has no handle for, and listens to no key on a page without any handle", () => {
    const panel = handle("panel");
    const document = documentOf([panel]);
    const root: PanelsRoot = { dataset: {} };
    expect(wirePanels(element(), document, storage(), root)).toBe(1);
    expect(document.press("[")).toBe(false);
    expect(root.dataset).toEqual({});
    expect(document.press("]")).toBe(true);
    expect(root.dataset.panels).toBe("panel");
    const none = documentOf([]);
    expect(wirePanels(element(), none, storage(), { dataset: {} })).toBe(0);
    expect(none.press("[")).toBe(false);
  });

  it("leaves a handle without a panel name alone, and keeps the served wording when the island carries no labels or the handle no name", () => {
    const stray = handle("drawer");
    const bare = handle("tree", false);
    const named = handle("panel");
    expect(
      wirePanels(element("{}"), documentOf([stray, bare, named]), storage(), { dataset: {} }),
    ).toBe(2);
    expect(stray.hidden).toBe(true);
    expect(bare.hidden).toBe(false);
    expect(named.hidden).toBe(false);
    expect(named.name?.textContent).toBe("Tree of the space");
    expect(named.attributes["title"]).toBe("Fold or unfold");
    const partial = handle("tree");
    wirePanels(
      element(JSON.stringify({ labels: { fold: "Replier ou déplier" } })),
      documentOf([partial]),
      storage(),
      { dataset: {} },
    );
    expect(partial.name?.textContent).toBe("Tree of the space");
    expect(partial.attributes["title"]).toBe("Replier ou déplier");
    const unserialised = handle("tree");
    wirePanels(element(null), documentOf([unserialised]), storage(), { dataset: {} });
    expect(unserialised.attributes["title"]).toBe("Fold or unfold");
    const nameless = handle("panel", false);
    wirePanels(element(), documentOf([nameless]), storage(), { dataset: {} });
    expect(nameless.name).toBeNull();
    expect(nameless.attributes["title"]).toBe("Replier ou déplier");
  });
});
