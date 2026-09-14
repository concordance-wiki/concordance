import { ISLAND_ELEMENT } from "./element.js";
import { wireTabs } from "./tabs.js";

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="tabs"]`)) {
  wireTabs(element, document, window);
}
