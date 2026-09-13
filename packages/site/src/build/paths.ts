import { posix } from "node:path";

import { pagePath } from "@concordance-wiki/core";

/** The pages of the site that are not an entity's, as paths under the output folder. */
export const HOME_PAGE = "index.html";
export const INDEX_PAGE = "index/index.html";
export const TODO_PAGE = "todo/index.html";
/** The placeholder of the search index: `{ entries: [{ id, title, type, url }] }` until the real index exists. */
export const SEARCH_INDEX = "search-index.json";
export const ASSETS_DIRECTORY = "assets";
export const FRAGMENTS_DIRECTORY = "fragments";

/** The fragment of an entity, next to the model: `fragments/<id>.json`. */
export function fragmentPath(id: string): string {
  return `${FRAGMENTS_DIRECTORY}/${id}.json`;
}

/** Where the build keeps an image of a note, by its target under the site, so that `render` places it without a source. */
export function fragmentImagePath(target: string): string {
  return `${FRAGMENTS_DIRECTORY}/${target}`;
}

/**
 * The href of one file of the site from a page, both as paths under the output folder: relative,
 * climbing with `..`, never starting with `/`, so that it resolves over `file://` as behind a server.
 */
export function relativeHref(from: string, to: string): string {
  return posix.relative(posix.dirname(from), to);
}

/** The href of an entity page from another page. */
export function entityHref(from: string, id: string): string {
  return relativeHref(from, pagePath(id));
}

/** The prefix of the asset hrefs from a page, `../assets/` for instance. */
export function assetsBaseOf(from: string): string {
  return `${relativeHref(from, ASSETS_DIRECTORY)}/`;
}
