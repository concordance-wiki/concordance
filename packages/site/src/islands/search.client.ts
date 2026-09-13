import { render, type JSX } from "preact";

import { SEARCH_ISLAND, SUGGESTIONS_CLASS } from "../search/shared.js";
import { ISLAND_ELEMENT } from "./element.js";
import { mountSearch, type SearchIslandElement } from "./search.js";

function adapt(element: HTMLElement): SearchIslandElement<HTMLElement> {
  return {
    getAttribute: (name) => element.getAttribute(name),
    input: () => element.querySelector("input"),
    panel: () => element.querySelector<HTMLElement>(`.${SUGGESTIONS_CLASS}`),
    container: () => element,
  };
}

mountSearch({
  islands: [
    ...document.querySelectorAll<HTMLElement>(`${ISLAND_ELEMENT}[data-island="${SEARCH_ISLAND}"]`),
  ].map(adapt),
  document,
  initialQuery: new URLSearchParams(location.search).get("q") ?? "",
  // A classic script, not a module: browsers load it from a file:// page, which they refuse to modules.
  inject: (src, done) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", () => {
      done(true);
    });
    script.addEventListener("error", () => {
      done(false);
    });
    document.head.appendChild(script);
  },
  host: window,
  render: (vnode: JSX.Element, container: HTMLElement) => {
    render(vnode, container);
  },
});
