import { ISLAND_ELEMENT } from "./element.js";
import { wireModeSwitch } from "./mode-switch.js";

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="mode-switch"]`)) {
  wireModeSwitch(element, localStorage, document.documentElement);
}
