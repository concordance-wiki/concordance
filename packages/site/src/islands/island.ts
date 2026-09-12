import { h, type ComponentType, type FunctionComponent, type JSX } from "preact";

/** The custom element that marks an island in the served HTML; unknown to the browser, it renders inline. */
export const ISLAND_ELEMENT = "concordance-island";

/**
 * Wraps a component so that its static markup is served with its props serialised next to it;
 * the hydration entry of the island reads them back and mounts the same component.
 */
export function island<P extends object>(
  name: string,
  Component: ComponentType<P>,
): FunctionComponent<P> {
  const Island = (props: P): JSX.Element =>
    h(
      ISLAND_ELEMENT,
      { "data-island": name, "data-props": JSON.stringify(props) },
      h(Component, props),
    );
  Island.displayName = `Island(${name})`;
  return Island;
}

/** Names of the islands present in a rendered document, unique and sorted. */
export function islandsUsed(html: string): string[] {
  const pattern = new RegExp(`<${ISLAND_ELEMENT} data-island="([^"]+)"`, "g");
  const names = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    // The group is unconditional in the pattern: a match always carries it.
    names.add(match[1] as string);
  }
  return [...names].sort();
}
