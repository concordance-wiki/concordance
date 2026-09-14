import type { FoldablePanel } from "./slots.js";

/** The `localStorage` key holding the side panels a reader folded; absent while every panel stands open. */
export const PANELS_STORAGE_KEY = "concordance-panels";

/** The two side panels of a page, as the stored value and the `data-panels` attribute of the root name them: the tree of the space, the right panel. */
export const PANELS: readonly FoldablePanel[] = ["tree", "panel"];

/** The key a reader presses to fold or unfold each panel, without any modifier, outside a field. */
export const PANEL_KEYS: Readonly<Record<FoldablePanel, string>> = {
  tree: "[",
  panel: "]",
};

/** Whether a value names a panel; a type guard, so that the names read from a value or an attribute type as panels. */
export function isPanel(value: string | null): value is FoldablePanel {
  return PANELS.some((panel) => panel === value);
}

/** The panels a stored value names, in the order of `PANELS`, each once; anything unknown left out. */
export function parseFolded(value: string | null): FoldablePanel[] {
  const names = new Set((value ?? "").split(" ").filter(isPanel));
  return PANELS.filter((panel) => names.has(panel));
}

/** The stored value naming the folded panels, `tree panel` for both; absent when none is folded. */
export function foldedValue(folded: readonly FoldablePanel[]): string | undefined {
  const value = PANELS.filter((panel) => folded.includes(panel)).join(" ");
  return value === "" ? undefined : value;
}

/**
 * The second inline script of a page, next to the one of the colour scheme: it copies the
 * stored folded panels to `data-panels` on the root before the first paint, so that a reader
 * who folded a panel never sees it open and fold. It is a constant, so a content security
 * policy can allow it by hash; without it, and without JavaScript, every panel stands open.
 */
export const PANELS_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(PANELS_STORAGE_KEY)});if(p)document.documentElement.dataset.panels=p}catch(e){}})()`;
