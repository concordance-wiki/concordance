import { ISLAND_ELEMENT } from "./element.js";
import { wirePins } from "./pins.js";

for (const element of document.querySelectorAll<HTMLElement>(
  `${ISLAND_ELEMENT}[data-island="pins"]`,
)) {
  wirePins(element, document, localStorage, window);
}
