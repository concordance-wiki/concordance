import { ISLAND_ELEMENT } from "../islands/element.js";
import { wireWidthSwitch } from "./width.js";

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="gallery-width"]`)) {
  wireWidthSwitch(element, document);
}
