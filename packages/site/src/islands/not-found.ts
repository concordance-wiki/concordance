import {
  SEARCH_DIRECTORY,
  SEARCH_META,
  type SearchEntry,
  type SearchMeta,
} from "../search/shared.js";
import type { NearbyPage } from "../slots.js";
import type { NotFoundIslandProps } from "../theme/default/not-found.js";
import { shardLoader, type ScriptInjector, type ShardHost } from "./shards.js";

/** The island of the page served for a missing address: it reads the address and names the nearby pages and the query. */
export const NOT_FOUND_ISLAND = "not-found";

/** How many nearby addresses the page lists at most. */
export const NEARBY_LIMIT = 3;

/** The address of a page under the site, without its file name nor its trailing slash: `glossary/publication-threshold`. */
export function pageAddress(path: string): string {
  return path.replace(/(?:^|\/)index\.html$/, "").replace(/^\/+|\/+$/g, "");
}

/** The address asked for, under the site: the path of the location without the folder of the page itself. */
export function missingAddress(pathname: string, baseUri: string): string {
  const folder = baseUri.replace(/^[a-z]+:\/\/[^/]*/i, "").replace(/[^/]*$/, "");
  const under = pathname.startsWith(folder) ? pathname.slice(folder.length) : pathname;
  return pageAddress(decodeURIComponent(under));
}

/** The edit distance between two addresses: insertions, deletions and substitutions of one character. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = (previous[column - 1] ?? 0) + (a[row - 1] === b[column - 1] ? 0 : 1);
      current.push(
        Math.min(substitution, (previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** How far an address may stand from the missing one to be proposed: half its length, three characters at least. */
export function nearbyThreshold(missing: string): number {
  return Math.max(3, Math.floor(missing.length / 2));
}

/**
 * The pages whose address is closest to the missing one, by edit distance on the path, the
 * closest first and the earliest in the table among equals, at most `NEARBY_LIMIT` of them
 * and none beyond the threshold; each with its address under the site and its href from the
 * root of the site.
 */
export function nearbyOf(
  missing: string,
  entries: readonly SearchEntry[],
  root: string,
): NearbyPage[] {
  if (missing === "") return [];
  const threshold = nearbyThreshold(missing);
  return entries
    .map((entry, index) => ({
      entry,
      index,
      distance: editDistance(missing, pageAddress(entry.url)),
    }))
    .filter(({ distance }) => distance <= threshold)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, NEARBY_LIMIT)
    .map(({ entry }) => ({
      title: entry.title,
      path: `/${pageAddress(entry.url)}/`,
      href: `${root}${entry.url}`,
    }));
}

/** The query the missing address suggests: its last segment, the hyphens and underscores as spaces. */
export function queryOf(missing: string): string {
  return (missing.split("/").pop() ?? "").replace(/[-_]+/g, " ").trim();
}

/** What the island needs from the window: the address asked for and the base the page resolves against. */
export interface NotFoundWindow {
  location: { pathname: string };
  document: { baseURI: string };
}

/**
 * The props of the page once the island read the address: the query from its last segment, and
 * the nearby pages from the table of the pages written at publication; the served props alone
 * when the table could not be loaded.
 */
export async function notFoundPropsOf(
  props: NotFoundIslandProps,
  win: NotFoundWindow,
  inject: ScriptInjector,
  host: ShardHost,
): Promise<NotFoundIslandProps> {
  const missing = missingAddress(win.location.pathname, win.document.baseURI);
  const query = queryOf(missing);
  const load = shardLoader(`${props.root}${SEARCH_DIRECTORY}/`, inject, host);
  // Written by the build: the table carries the shape the index builder serialises.
  const meta = (await load(SEARCH_META)) as SearchMeta | undefined;
  const nearby = meta === undefined ? [] : nearbyOf(missing, meta.entities, props.root);
  return {
    ...props,
    ...(query === "" ? {} : { query }),
    ...(nearby.length === 0 ? {} : { nearby }),
  };
}

/** What the island needs from the document: elements made for the list of the nearby pages. */
export interface NotFoundDocument {
  createElement(tag: string): Element;
}

/**
 * Wires the island of one page: reads its props and the address, then fills the served markup
 * in place: the search exit worded on the last segment of the address and led to the search
 * on it, the nearby pages listed and their block shown. Nothing changes for an address that
 * gives no query and no nearby page, nor for an island without the served markup.
 */
export async function wireNotFound(
  element: Element,
  doc: NotFoundDocument,
  win: NotFoundWindow,
  inject: ScriptInjector,
  host: ShardHost,
): Promise<boolean> {
  // Written by the build: the island serialises the props of its own component.
  const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as NotFoundIslandProps;
  const search = element.querySelector(".button-primary");
  const nearby = element.querySelector(".not-found-nearby");
  const list = nearby?.querySelector("ul");
  if (search === null || nearby === null || list === null || list === undefined) return false;
  const filled = await notFoundPropsOf(props, win, inject, host);
  if (filled.query !== undefined) {
    search.setAttribute("href", `${filled.searchHref}?q=${encodeURIComponent(filled.query)}`);
    search.textContent = filled.searchQueryLabel.replace("{query}", filled.query);
  }
  for (const page of filled.nearby ?? []) {
    const item = doc.createElement("li");
    const link = doc.createElement("a");
    link.setAttribute("href", page.href);
    const title = doc.createElement("span");
    title.setAttribute("class", "not-found-nearby-title");
    title.textContent = page.title;
    const path = doc.createElement("code");
    path.setAttribute("class", "not-found-nearby-path");
    path.textContent = page.path;
    link.append(title, path);
    item.append(link);
    list.append(item);
  }
  if (filled.nearby !== undefined) nearby.removeAttribute("hidden");
  return filled.query !== undefined || filled.nearby !== undefined;
}
