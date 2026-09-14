import { posix } from "node:path";

import { pagePath } from "@concordance-wiki/core";

/** The pages of the site that are not an entity's, as paths under the output folder. */
export const HOME_PAGE = "index.html";
export const INDEX_PAGE = "index/index.html";
export const TODO_PAGE = "todo/index.html";
/** The results page; the files of the index sit next to it under `search/`. */
export const SEARCH_PAGE = "search/index.html";
/** The page listing every space. */
export const SPACES_PAGE = "spaces/index.html";
/** The page saying where the site comes from and when it was built. */
export const ABOUT_PAGE = "about/index.html";
export const ASSETS_DIRECTORY = "assets";
export const FRAGMENTS_DIRECTORY = "fragments";

/** The fragment of an entity, next to the model: `fragments/<id>.json`. */
export function fragmentPath(id: string): string {
  return `${FRAGMENTS_DIRECTORY}/${id}.json`;
}

/** The JSON view of the contract of an API, next to its fragment: `fragments/<id>.contract.json`. */
export function contractFragmentPath(id: string): string {
  return `${FRAGMENTS_DIRECTORY}/${id}.contract.json`;
}

/** Whether a contract location is fetched rather than read from the source. */
export function isContractUrl(location: string): boolean {
  return /^https?:\/\//.test(location);
}

/**
 * Where the copy of a path contract lands under the site: next to the page of its API, under the
 * file name the note points at. A URL contract is never copied.
 */
export function contractFileTarget(id: string, location: string): string {
  return `${id}/${posix.basename(location)}`;
}

/** Where the build keeps an image of a note, by its target under the site, so that `render` places it without a source. */
export function fragmentImagePath(target: string): string {
  return `${FRAGMENTS_DIRECTORY}/${target}`;
}

/** The mentions of an entity, one file per entity and never a global index: `fragments/<id>.mentions.json`. */
export function mentionsFragmentPath(id: string): string {
  return `${FRAGMENTS_DIRECTORY}/${id}.mentions.json`;
}

/**
 * The href of one file of the site from a page, both as paths under the output folder: relative,
 * climbing with `..`, never starting with `/`, so that it resolves over `file://` as behind a server.
 */
export function relativeHref(from: string, to: string): string {
  return posix.relative(posix.dirname(from), to);
}

/** The page of a space, at the root of the source: `<source>/index.html`, where no entity page stands since an identifier has two segments at least. */
export function spacePagePath(source: string): string {
  return `${source}/index.html`;
}

/** The href of the page of a space from another page. */
export function spaceHref(from: string, source: string): string {
  return relativeHref(from, spacePagePath(source));
}

/** The results page filtered on one value of a facet, from a page: `search/index.html?type=rule`. */
export function searchFilterHref(from: string, facet: string, value: string): string {
  return `${relativeHref(from, SEARCH_PAGE)}?${facet}=${encodeURIComponent(value)}`;
}

/** The href of an entity page from another page. */
export function entityHref(from: string, id: string): string {
  return relativeHref(from, pagePath(id));
}

/** The prefix of the asset hrefs from a page, `../assets/` for instance. */
export function assetsBaseOf(from: string): string {
  return `${relativeHref(from, ASSETS_DIRECTORY)}/`;
}

/** The prefix of the hrefs from a page to the site root, `../../` for instance; empty at the root. */
export function siteRootOf(from: string): string {
  const up = relativeHref(from, ".");
  return up === "" ? "" : `${up}/`;
}
