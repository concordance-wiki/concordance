import { ISLAND_ELEMENT } from "./element.js";
import { NOT_FOUND_ISLAND, wireNotFound } from "./not-found.js";

// A classic script, not a module: browsers load it from a file:// page, which they refuse to modules.
function inject(src: string, done: (loaded: boolean) => void): void {
  const script = document.createElement("script");
  script.src = src;
  script.addEventListener("load", () => {
    done(true);
  });
  script.addEventListener("error", () => {
    done(false);
  });
  document.head.appendChild(script);
}

for (const element of document.querySelectorAll(
  `${ISLAND_ELEMENT}[data-island="${NOT_FOUND_ISLAND}"]`,
)) {
  void wireNotFound(element, document, window, inject, window);
}
