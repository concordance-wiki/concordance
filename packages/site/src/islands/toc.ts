import { TOC_CURRENT } from "../theme/default/toc.js";

/** A link of the table of contents, as the island marks it. */
export interface TocLink {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** The island element written at build, holding the list of links. */
export interface TocElement {
  querySelectorAll(selector: string): Iterable<TocLink>;
}

/** What the island needs from the document: the section a link points at. */
export interface TocDocument {
  getElementById(id: string): Element | null;
}

/** One observed section: whether its heading crossed into the band under the top of the viewport. */
export interface TocEntryChange {
  target: Element;
  isIntersecting: boolean;
}

/** The part of `IntersectionObserver` the island uses, injected so that a document without it is left as served. */
export interface TocObserver {
  observe(target: Element): void;
}

export type TocObserverCallback = (changes: TocEntryChange[]) => void;

export type TocObserverFactory = (
  callback: TocObserverCallback,
  options: { rootMargin: string },
) => TocObserver;

/** The band under the top of the viewport a heading enters to make its section the current one: the top third. */
export const TOC_ROOT_MARGIN = "0px 0px -66% 0px";

/**
 * Marks the entry of the section being read: the last section whose heading entered the top
 * third of the viewport, the first entry until any does. Every link keeps its `href`; only
 * `aria-current` moves. Without an observer, or without any section to observe, the served
 * mark stays on the first entry.
 */
export function wireToc(
  element: TocElement,
  doc: TocDocument,
  observe: TocObserverFactory | undefined,
): boolean {
  const links = [...element.querySelectorAll('a[href^="#"]')];
  const sections = links.map((link) =>
    doc.getElementById((link.getAttribute("href") ?? "").slice(1)),
  );
  const observed = sections.filter((section): section is Element => section !== null);
  if (observe === undefined || observed.length === 0) {
    return false;
  }
  const visible = new Set<Element>();
  const mark = (): void => {
    let current = 0;
    sections.forEach((section, index) => {
      if (section !== null && visible.has(section)) {
        current = index;
      }
    });
    links.forEach((link, index) => {
      if (index === current) {
        link.setAttribute("aria-current", TOC_CURRENT);
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };
  const observer = observe(
    (changes) => {
      for (const change of changes) {
        if (change.isIntersecting) {
          visible.add(change.target);
        } else {
          visible.delete(change.target);
        }
      }
      mark();
    },
    { rootMargin: TOC_ROOT_MARGIN },
  );
  for (const section of observed) {
    observer.observe(section);
  }
  return true;
}
