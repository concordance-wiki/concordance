import type { Entity } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { BreadcrumbItem, SpaceNode, SpaceTree } from "../slots.js";
import type { SiteContext } from "./context.js";
import { entityHref, HOME_PAGE, relativeHref } from "./paths.js";

/** The id of the file tree entry of the home page, where the spaces are listed. */
export const HOME_TREE_ANCHOR = "home-tree";
/** The id of the latest changes entry of the home page. */
export const HOME_RECENT_ANCHOR = "home-recent";
/** How many pages of one folder the tree lists at most: a window around the current page, the rest counted on one node. */
export const SPACE_PAGES_MAX = 40;

/** Two letters standing for a space: the initials of its first two words, or the first two letters of its only one, in capitals. */
export function initialsOf(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
  const letters =
    words.length >= 2
      ? words.slice(0, 2).map((word) => word.slice(0, 1))
      : // A name of one word or none: its first two code points, so that an accented letter stays whole.
        Array.from(words[0] ?? name).slice(0, 2);
  return letters.join("").toUpperCase();
}

interface Folder {
  folders: Map<string, Folder>;
  pages: { file: string; entity: Entity }[];
}

function folderIn(folders: Map<string, Folder>, name: string): Folder {
  const known = folders.get(name);
  if (known !== undefined) return known;
  const created: Folder = { folders: new Map(), pages: [] };
  folders.set(name, created);
  return created;
}

function pagesIn(folder: Folder): number {
  return [...folder.folders.values()].reduce(
    (total, child) => total + pagesIn(child),
    folder.pages.length,
  );
}

/** The folders of a path, `screens/service` giving `["screens", "service"]`; none for a file at the root. */
function foldersOf(path: string): string[] {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? [] : path.slice(0, cut).split("/");
}

/** The notes of one source, folded into its folders. */
function treeOf(context: SiteContext, source: string): Folder {
  const root: Folder = { folders: new Map(), pages: [] };
  for (const entity of context.model.entities) {
    if (entity.keyword === true || entity.source.name !== source) continue;
    const { path } = entity.source;
    let current = root;
    for (const segment of foldersOf(path)) {
      current = folderIn(current.folders, segment);
    }
    current.pages.push({ file: path.slice(path.lastIndexOf("/") + 1), entity });
  }
  return root;
}

/**
 * The nodes of a folder: its folders first, sorted by name, then its pages sorted by file name;
 * a folder on the way to the current page lists its contents, the others show their count alone.
 */
function nodesOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  folder: Folder,
  way: readonly string[],
): SpaceNode[] {
  const [next, ...rest] = way;
  const folders = [...folder.folders.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, child]): SpaceNode => ({
      label: name,
      count: pagesIn(child),
      ...(name === next ? { children: nodesOf(context, page, entity, child, rest) } : {}),
    }));
  // Two notes of a source never share a path: the file name alone orders a folder.
  const pages = [...folder.pages]
    .sort((a, b) => byCodeUnit(a.file, b.file))
    .map(({ entity: note }): SpaceNode =>
      note.id === entity.id
        ? { label: note.title, current: true }
        : { label: note.title, href: entityHref(page, note.id) },
    );
  return [...folders, ...windowOf(context, pages)];
}

/**
 * The pages of a folder the tree lists: all of them under `SPACE_PAGES_MAX`, else a window of
 * that many centred on the current page, or the first ones when the current page lies deeper,
 * the pages left out counted on one node at each end.
 */
function windowOf(context: SiteContext, pages: SpaceNode[]): SpaceNode[] {
  if (pages.length <= SPACE_PAGES_MAX) return pages;
  const at = pages.findIndex((node) => node.current === true);
  const start = Math.max(
    0,
    Math.min(Math.max(at, 0) - SPACE_PAGES_MAX / 2, pages.length - SPACE_PAGES_MAX),
  );
  const end = start + SPACE_PAGES_MAX;
  const omitted = (count: number): SpaceNode[] =>
    count === 0
      ? []
      : [
          {
            label: formatMessage(context.catalogue, "entity.otherPages", { count }),
            omitted: true,
          },
        ];
  return [...omitted(start), ...pages.slice(start, end), ...omitted(pages.length - end)];
}

/** The tree of the space of an entity: its source, the folders on the way to the page open, the page marked as current. */
export function spaceOf(context: SiteContext, page: string, entity: Entity): SpaceTree {
  const source = entity.source.name;
  return {
    name: source,
    initials: initialsOf(source),
    nodes: nodesOf(context, page, entity, treeOf(context, source), foldersOf(entity.source.path)),
  };
}

/**
 * The tree of a space for a page that has no file in it: the keyword page of an expression,
 * filed at the root of the space under `<slug>.md`, so that the word stands among the notes as
 * the current page, at the place a note of that name would take.
 */
export function spaceWithPageOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  source: string,
): SpaceTree {
  const root = treeOf(context, source);
  root.pages.push({ file: `${entity.id.slice(entity.id.lastIndexOf("/") + 1)}.md`, entity });
  return {
    name: source,
    initials: initialsOf(source),
    nodes: nodesOf(context, page, entity, root, []),
  };
}

/** Space › folders › page: the space links to the file tree of the home page, a folder has no page, the page is the current one. */
export function breadcrumbOf(page: string, entity: Entity): BreadcrumbItem[] {
  return [
    { label: entity.source.name, href: `${relativeHref(page, HOME_PAGE)}#${HOME_TREE_ANCHOR}` },
    ...foldersOf(entity.source.path).map((label) => ({ label })),
    { label: entity.title },
  ];
}

/** The nodes of a folder with every folder open and every page a link: the folders first, then the pages by file name and identifier. */
function openNodesOf(page: string, folder: Folder): SpaceNode[] {
  const folders = [...folder.folders.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, child]): SpaceNode => ({
      label: name,
      count: pagesIn(child),
      children: openNodesOf(page, child),
    }));
  const pages = [...folder.pages]
    .sort((a, b) => byCodeUnit(a.file, b.file) || byCodeUnit(a.entity.id, b.entity.id))
    .map(({ entity }): SpaceNode => ({ label: entity.title, href: entityHref(page, entity.id) }));
  return [...folders, ...pages];
}

/** The whole tree of a source from `page`, every folder open and every page listed: what the home page folds behind the row of a space. */
export function wholeTreeOf(context: SiteContext, page: string, source: string): SpaceNode[] {
  return openNodesOf(page, treeOf(context, source));
}
