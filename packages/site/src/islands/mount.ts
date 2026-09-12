import { h, type ComponentType, type JSX } from "preact";

import { ISLAND_ELEMENT } from "./island.js";

/** What a hydration entry needs from an island element: the serialised props. */
export interface IslandElement {
  getAttribute(name: string): string | null;
}

export interface IslandHost<E extends IslandElement> {
  querySelectorAll(selector: string): Iterable<E>;
}

/** Mounts a component on every island of that name in the host; returns how many were mounted. */
export function mountIslands<P extends object, E extends IslandElement>(
  name: string,
  Component: ComponentType<P>,
  host: IslandHost<E>,
  mount: (vnode: JSX.Element, element: E) => void,
): number {
  let mounted = 0;
  for (const element of host.querySelectorAll(`${ISLAND_ELEMENT}[data-island="${name}"]`)) {
    // Written by island() at build: the attribute carries the props of this very component.
    const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as P;
    mount(h(Component, props), element);
    mounted += 1;
  }
  return mounted;
}
