import {
  foldedValue,
  isPanel,
  PANEL_KEYS,
  PANELS,
  PANELS_STORAGE_KEY,
  parseFolded,
} from "../panels.js";
import type { FoldablePanel, PanelsProps } from "../slots.js";
import { isEditable, type KeyEvent } from "./editable.js";

/** The part of `localStorage` the panels use; every call may throw when storage is disabled. */
export interface PanelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The root element, whose `data-panels` the stylesheet reads to fold the panels. */
export interface PanelsRoot {
  dataset: { panels?: string };
}

export interface HandleText {
  textContent: string | null;
}

/** The handle of one panel, served hidden on the edge of the panel it folds. */
export interface HandleElement {
  hidden: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
  querySelector(selector: string): HandleText | null;
}

/** What the island needs from the document: the handles of the page, and the keys pressed anywhere in it. */
export interface PanelsDocument {
  querySelectorAll(selector: string): Iterable<HandleElement>;
  addEventListener(type: "keydown", listener: (event: KeyEvent) => void): void;
}

/** The island element written at build, holding the serialised labels. */
export interface PanelsElement {
  getAttribute(name: string): string | null;
}

/** The panels stored as folded, or none when nothing valid is stored or storage cannot be read. */
export function readFolded(storage: PanelStorage): FoldablePanel[] {
  try {
    return parseFolded(storage.getItem(PANELS_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Applies the folded panels to `data-panels` on the root and remembers them; a failing storage still changes the page. */
export function applyFolded(
  folded: readonly FoldablePanel[],
  storage: PanelStorage,
  root: PanelsRoot,
): void {
  const value = foldedValue(folded);
  if (value === undefined) {
    delete root.dataset.panels;
  } else {
    root.dataset.panels = value;
  }
  try {
    if (value === undefined) {
      storage.removeItem(PANELS_STORAGE_KEY);
    } else {
      storage.setItem(PANELS_STORAGE_KEY, value);
    }
  } catch {
    // Storage disabled: the panels hold for this page only.
  }
}

/** The folded panels with one of them folded or unfolded, in the order of the panels. */
export function toggleFolded(
  folded: readonly FoldablePanel[],
  panel: FoldablePanel,
): FoldablePanel[] {
  return PANELS.filter((name) =>
    name === panel ? !folded.includes(panel) : folded.includes(name),
  );
}

/**
 * Reveals the handles of the page and makes each one fold and unfold its panel: the handle
 * announces the state of its panel and names it in the language of the site, the root carries
 * the folded panels for the stylesheet, and the storage keeps them for the next page. The `[`
 * and `]` keys, pressed outside a field, fold and unfold the tree and the right panel.
 */
export function wirePanels(
  element: PanelsElement,
  document: PanelsDocument,
  storage: PanelStorage,
  root: PanelsRoot,
): number {
  // Written by island() at build: the attribute carries the props of the island.
  const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as Partial<PanelsProps>;
  const handles = new Map<FoldablePanel, HandleElement>();
  for (const handle of document.querySelectorAll(".panel-handle")) {
    const panel = handle.getAttribute("data-panel");
    if (isPanel(panel)) {
      handles.set(panel, handle);
    }
  }
  let folded = readFolded(storage);
  const show = (): void => {
    for (const [panel, handle] of handles) {
      handle.setAttribute("aria-expanded", folded.includes(panel) ? "false" : "true");
    }
  };
  const toggle = (panel: FoldablePanel): void => {
    folded = toggleFolded(folded, panel);
    applyFolded(folded, storage, root);
    show();
  };
  for (const [panel, handle] of handles) {
    const name = handle.querySelector(".visually-hidden");
    const label = props.labels?.[panel];
    if (name !== null && label !== undefined) {
      name.textContent = label;
    }
    if (props.labels?.fold !== undefined) {
      handle.setAttribute("title", props.labels.fold);
    }
    handle.addEventListener("click", () => {
      toggle(panel);
    });
  }
  show();
  if (handles.size > 0) {
    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) {
        return;
      }
      const panel = PANELS.find((name) => PANEL_KEYS[name] === event.key);
      if (panel !== undefined && handles.has(panel)) {
        event.preventDefault();
        toggle(panel);
      }
    });
  }
  for (const handle of handles.values()) {
    handle.hidden = false;
  }
  return handles.size;
}
