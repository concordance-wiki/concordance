import { ISLAND_ELEMENT } from "./element.js";
import { wireToc, type TocObserverCallback } from "./toc.js";

const observe =
  typeof IntersectionObserver === "undefined"
    ? undefined
    : (callback: TocObserverCallback, options: { rootMargin: string }) =>
        new IntersectionObserver((entries) => {
          callback(entries);
        }, options);

for (const element of document.querySelectorAll(`${ISLAND_ELEMENT}[data-island="toc"]`)) {
  wireToc(element, document, observe);
}
