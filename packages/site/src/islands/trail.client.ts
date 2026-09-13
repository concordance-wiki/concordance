import { ISLAND_ELEMENT } from "./element.js";
import { wireTrail } from "./trail.js";

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="trail"]`)) {
  wireTrail(element, {
    document,
    location,
    history,
    local: localStorage,
    session: sessionStorage,
  });
}
