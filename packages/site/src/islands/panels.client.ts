import { ISLAND_ELEMENT } from "./element.js";
import { wirePanels } from "./panels.js";

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="panels"]`)) {
  wirePanels(element, document, localStorage, document.documentElement);
}
