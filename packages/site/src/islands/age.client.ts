import { AGE_ISLAND, wireAgeNotice } from "./age.js";
import { ISLAND_ELEMENT } from "./element.js";

for (const element of document.querySelectorAll<HTMLElement>(
  `${ISLAND_ELEMENT}[data-island="${AGE_ISLAND}"]`,
)) {
  wireAgeNotice(element, Date.now(), localStorage);
}
