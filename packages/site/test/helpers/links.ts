import { posix } from "node:path";

/** Every `href` and `src` value of a page, in document order. */
export function references(html: string): string[] {
  return [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((match) => match[1] ?? "");
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

/**
 * The references of a page that name a file of the site, resolved against the page's path: what
 * must exist for the page to work over `file://` as behind a server.
 */
export function localTargets(page: string, html: string): { reference: string; target: string }[] {
  return references(html)
    .filter((reference) => !EXTERNAL.test(reference))
    .map((reference) => ({
      reference,
      target: posix.join(posix.dirname(page), reference.replace(/[#?].*$/, "")),
    }));
}
