import type { ColourScheme } from "../css/tokens.js";
import { MODE_STORAGE_KEY, otherScheme, switchGlyph, type ModeChoice } from "../mode.js";

/** The part of `localStorage` the switch uses; every call may throw when storage is disabled. */
export interface ModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The root element, whose `data-mode` the tokens layer reads. */
export interface ModeRoot {
  dataset: { mode?: string };
}

/**
 * What the page displays: the scheme the tokens layer put in force, whatever decided it, the
 * theme's default, the system preference or a remembered choice; and a way to hear the system
 * preference change while no choice is stored.
 */
export interface SchemeView {
  displayed(): ColourScheme;
  onPreferenceChange(listener: () => void): void;
}

export interface ModeSwitchText {
  textContent: string | null;
}

export interface ModeSwitchButton {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
  querySelector(selector: string): ModeSwitchText | null;
}

/** The island element written at build, holding the button; its label is written in the markup. */
export interface ModeSwitchElement {
  querySelector(selector: string): ModeSwitchButton | null;
}

/** Applies a choice to the root and remembers it; a failing storage still changes the page. */
export function applyChoice(choice: ModeChoice, storage: ModeStorage, root: ModeRoot): void {
  if (choice === "system") {
    delete root.dataset.mode;
  } else {
    root.dataset.mode = choice;
  }
  try {
    if (choice === "system") {
      storage.removeItem(MODE_STORAGE_KEY);
    } else {
      storage.setItem(MODE_STORAGE_KEY, choice);
    }
  } catch {
    // Storage disabled: the choice holds for this page only.
  }
}

/**
 * The choice that displays the other scheme: nothing stored when the theme's default and the
 * system preference already give it, so that the page follows the system again; the scheme
 * itself otherwise, remembered until the reader switches back.
 */
export function toggleChoice(view: SchemeView, root: ModeRoot): ModeChoice {
  const target = otherScheme(view.displayed());
  delete root.dataset.mode;
  return view.displayed() === target ? "system" : target;
}

/** The scheme the tokens layer names on the root, read from its computed style; light when it names none. */
export function displayedScheme(read: (property: string) => string): ColourScheme {
  return read("--scheme").trim() === "dark" ? "dark" : "light";
}

/**
 * Reveals the button of one island and makes it toggle the scheme: the glyph draws the scheme it
 * switches to, a moon over a light page, a sun over a dark one, and the button is pressed while
 * the dark scheme is displayed. The label written at build, "Dark mode", is the same in both
 * states: the pressed state tells which one holds.
 */
export function wireModeSwitch(
  element: ModeSwitchElement,
  storage: ModeStorage,
  root: ModeRoot,
  view: SchemeView,
): boolean {
  const button = element.querySelector("button");
  if (button === null) {
    return false;
  }
  const glyph = button.querySelector(".mode-switch-glyph");
  const show = (): void => {
    const displayed = view.displayed();
    button.setAttribute("aria-pressed", displayed === "dark" ? "true" : "false");
    if (glyph !== null) {
      glyph.textContent = switchGlyph(displayed);
    }
  };
  button.addEventListener("click", () => {
    applyChoice(toggleChoice(view, root), storage, root);
    show();
  });
  view.onPreferenceChange(show);
  show();
  button.hidden = false;
  return true;
}
