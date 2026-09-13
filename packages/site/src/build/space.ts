import { pagePath, slugify, type Entity } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { BreadcrumbItem, SpaceLink, SpaceNode, SpaceTree } from "../slots.js";
import type { SiteContext } from "./context.js";
import { entityHref, relativeHref, spaceHref } from "./paths.js";

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

/** The category of a path, its top-level folder; none for a file at the root of the source. */
export function categoryOf(path: string): string | undefined {
  return foldersOf(path)[0];
}

/** A top-level folder of a source with how many pages it holds, folders included, and the page the tree lists first under it. */
export interface FolderCount {
  name: string;
  count: number;
  /** The first page of the folder in tree order: its first folder's first page, else its first file. */
  first: Entity;
}

/** The first page of a folder in the order the tree draws it: folders before pages, each sorted by name. A folder exists because a note lies under it. */
function firstPageOf(folder: Folder): Entity {
  const [child] = [...folder.folders.entries()].sort(([a], [b]) => byCodeUnit(a, b));
  if (child !== undefined) return firstPageOf(child[1]);
  const [page] = [...folder.pages].sort(
    (a, b) => byCodeUnit(a.file, b.file) || byCodeUnit(a.entity.id, b.entity.id),
  );
  // A folder of the tree holds a page or a folder, never nothing: the recursion ends on a page.
  return (page as { entity: Entity }).entity;
}

/** The top-level folders of a source, sorted by name, each with its page count: the categories of the space. */
export function topFoldersOf(context: SiteContext, source: string): FolderCount[] {
  return [...treeOf(context, source).folders.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, folder]) => ({ name, count: pagesIn(folder), first: firstPageOf(folder) }));
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

/**
 * Where the list of a folder at the top of a space lands: `<source>/<folder slug>/index.html`,
 * the address a note of that identifier would take; none when a note takes it.
 */
export function categoryPagePathOf(
  context: SiteContext,
  source: string,
  folder: string,
): string | undefined {
  const id = `${source}/${slugify(folder)}`;
  return context.entities.has(id) ? undefined : pagePath(id);
}

/** The folders at the top of the space linked to their lists, from `page`; the rest of the nodes as given. */
function withCategoryLinks(
  context: SiteContext,
  page: string,
  source: string,
  nodes: SpaceNode[],
): SpaceNode[] {
  return nodes.map((node) => {
    if (node.count === undefined) return node;
    const target = categoryPagePathOf(context, source, node.label);
    return target === undefined ? node : { ...node, href: relativeHref(page, target) };
  });
}

/** The tree of the space of an entity: its source, the folders on the way to the page open, the page marked as current, every folder at the top linked to its list. */
export function spaceOf(context: SiteContext, page: string, entity: Entity): SpaceTree {
  const source = entity.source.name;
  return {
    name: source,
    initials: initialsOf(source),
    nodes: withCategoryLinks(
      context,
      page,
      source,
      nodesOf(context, page, entity, treeOf(context, source), foldersOf(entity.source.path)),
    ),
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
    nodes: withCategoryLinks(context, page, source, nodesOf(context, page, entity, root, [])),
  };
}

/** A space of the site as the drawer lists it: its name, its initials and how many notes it holds. */
export interface SpaceCount {
  name: string;
  initials: string;
  count: number;
}

/** Every source of the site with its note count, sorted by name: those the build declares and those met on a note. */
export function spaceCountsOf(context: SiteContext): SpaceCount[] {
  const counts = new Map<string, number>();
  for (const source of context.model.build.sources) {
    counts.set(source.name, 0);
  }
  for (const entity of context.model.entities) {
    if (entity.keyword === true) continue;
    counts.set(entity.source.name, (counts.get(entity.source.name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, count]) => ({ name, initials: initialsOf(name), count }));
}

/** The spaces as the drawer of a page links them: each to its own page. */
export function spaceLinksOf(page: string, spaces: readonly SpaceCount[]): SpaceLink[] {
  return spaces.map(({ name, initials, count }) => ({
    label: name,
    href: spaceHref(page, name),
    initials,
    count,
  }));
}

/** Space › folders › page: the space links to its page, the folder at the top to its list, a deeper folder has no page, the page is the current one. */
export function breadcrumbOf(context: SiteContext, page: string, entity: Entity): BreadcrumbItem[] {
  const source = entity.source.name;
  return [
    { label: source, href: spaceHref(page, source) },
    ...foldersOf(entity.source.path).map((label, index): BreadcrumbItem => {
      const target = index === 0 ? categoryPagePathOf(context, source, label) : undefined;
      return target === undefined ? { label } : { label, href: relativeHref(page, target) };
    }),
    { label: entity.title },
  ];
}
