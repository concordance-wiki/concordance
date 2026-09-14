import { ISLAND_ELEMENT } from "./element.js";
import { displayedScheme, wireModeSwitch, type SchemeView } from "./mode-switch.js";

const root = document.documentElement;

/** The scheme in force, read from the tokens layer; the system preference heard through its media query. */
const view: SchemeView = {
  displayed: () => displayedScheme((property) => getComputedStyle(root).getPropertyValue(property)),
  onPreferenceChange: (listener) => {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", listener);
  },
};

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="mode-switch"]`)) {
  wireModeSwitch(element, localStorage, root, view);
}
