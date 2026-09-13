import { MODE_GLYPHS, MODE_STORAGE_KEY, MODES, modeSwitchName, type ModeChoice } from "../mode.js";
import type { ModeSwitchProps } from "../theme/default/mode-switch.js";

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

export interface ModeSwitchText {
  textContent: string | null;
}

export interface ModeSwitchButton {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
  querySelector(selector: string): ModeSwitchText | null;
}

/** The island element written at build, holding the serialised labels and the button. */
export interface ModeSwitchElement {
  getAttribute(name: string): string | null;
  querySelector(selector: string): ModeSwitchButton | null;
}

function isForced(value: string | null): value is Exclude<ModeChoice, "system"> {
  return value === "light" || value === "dark";
}

/** The stored choice, or `system` when nothing valid is stored or storage cannot be read. */
export function readChoice(storage: ModeStorage): ModeChoice {
  try {
    const stored = storage.getItem(MODE_STORAGE_KEY);
    return isForced(stored) ? stored : "system";
  } catch {
    return "system";
  }
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

export function nextChoice(choice: ModeChoice): ModeChoice {
  // The index is always found: a choice is one of the modes; the modulo keeps it in range.
  return MODES[(MODES.indexOf(choice) + 1) % MODES.length] as ModeChoice;
}

/**
 * Reveals the button of one island and makes it cycle through the modes: the glyph draws the
 * current one, its name and its title read the current choice for assistive technology.
 */
export function wireModeSwitch(
  element: ModeSwitchElement,
  storage: ModeStorage,
  root: ModeRoot,
): boolean {
  const button = element.querySelector("button");
  if (button === null) {
    return false;
  }
  // Written by island() at build: the attribute carries the props of the switch.
  const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as Partial<ModeSwitchProps>;
  const glyph = button.querySelector(".mode-switch-glyph");
  const value = button.querySelector(".mode-switch-value");
  let current = readChoice(storage);
  const show = (): void => {
    const choice = props.labels?.[current] ?? current;
    const name = modeSwitchName(props.name ?? "", choice);
    button.setAttribute("aria-pressed", current === "system" ? "false" : "true");
    button.setAttribute("aria-label", name);
    button.setAttribute("title", name);
    if (glyph !== null) {
      glyph.textContent = MODE_GLYPHS[current];
    }
    if (value !== null) {
      value.textContent = choice;
    }
  };
  button.addEventListener("click", () => {
    current = nextChoice(current);
    applyChoice(current, storage, root);
    show();
  });
  show();
  button.hidden = false;
  return true;
}
