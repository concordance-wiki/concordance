import { pagePath, slugify, type Entity } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { BreadcrumbItem, SpaceLink, SpaceNode, SpaceTree } from "../slots.js";
import { spaceTitle, type SiteContext } from "./context.js";
import { exposedOperations } from "./operations.js";
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

/** The initials of a space as its badge shows them: those of its title. */
export function spaceInitials(context: SiteContext, source: string): string {
  return initialsOf(spaceTitle(context, source));
}

/** A folder of a source as the tree draws it: its folders and its pages, by name. */
export interface Folder {
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

/** How many pages a folder holds, its folders included. */
export function pagesIn(folder: Folder): number {
  return [...folder.folders.values()].reduce(
    (total, child) => total + pagesIn(child),
    folder.pages.length,
  );
}

/** The folders of a path, `screens/service` giving `["screens", "service"]`; none for a file at the root. */
export function foldersOf(path: string): string[] {
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
export function treeOf(context: SiteContext, source: string): Folder {
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

/** The label of a folder of a space, named by the folders on its way: the title the configuration gives it, else its name as written on the paths. */
export function folderLabel(
  context: SiteContext,
  source: string,
  folders: readonly string[],
): string {
  const path = folders.join("/");
  return context.folders?.[source]?.[path]?.title ?? path.slice(path.lastIndexOf("/") + 1);
}

/** The sentence the configuration gives a folder of a space; none without one. */
export function folderDescription(
  context: SiteContext,
  source: string,
  folders: readonly string[],
): string | undefined {
  return context.folders?.[source]?.[folders.join("/")]?.description;
}

/**
 * Where the list of a folder of a space lands, named by the folders on its way:
 * `<source>/<folder slugs>/index.html`, the address a note of that identifier would take;
 * none when a note takes it.
 */
export function categoryPagePathOf(
  context: SiteContext,
  source: string,
  folders: readonly string[],
): string | undefined {
  const id = [source, ...folders.map(slugify)].join("/");
  return context.entities.has(id) ? undefined : pagePath(id);
}

/** A folder node linked to its list from `page`, when the folder has one. */
export function withListLink(
  context: SiteContext,
  page: string,
  source: string,
  folders: readonly string[],
  node: SpaceNode,
): SpaceNode {
  const target = categoryPagePathOf(context, source, folders);
  return target === undefined ? node : { ...node, href: relativeHref(page, target) };
}

/**
 * The pages the tree hangs under the current one: the operations of an API, in model order,
 * so that an interface reads with its operations as its children whatever folder they are
 * filed in. Any other page has none.
 */
function underOf(context: SiteContext, page: string, entity: Entity): SpaceNode[] {
  return exposedOperations(context, entity).map(({ entity: operation }): SpaceNode => ({
    label: operation.title,
    href: entityHref(page, operation.id),
  }));
}

/** What the tree opens on: the folders on the way to the current page, which is a note or the list of the last folder. */
interface TreeFocus {
  /** The folders on the way, as written on the paths. */
  way: readonly string[];
  /** The note marked as the current page; absent when the list of the last folder of the way is the current page. */
  entity?: Entity;
  /** How many passages use the word, when the current page is a keyword page filed among the notes. */
  passages?: number;
}

/**
 * The nodes of a folder: its folders first, sorted by name, each linked to its list when it has
 * one, then its pages sorted by file name; a folder on the way to the current page lists its
 * contents, the others show their count alone; the folder whose list is the current page is
 * marked and closed; the current page lists what hangs under it.
 */
function nodesOf(
  context: SiteContext,
  page: string,
  source: string,
  folder: Folder,
  prefix: readonly string[],
  focus: TreeFocus,
): SpaceNode[] {
  const next = focus.way[prefix.length];
  const folders = [...folder.folders.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, child]): SpaceNode => {
      const path = [...prefix, name];
      const node: SpaceNode = { label: folderLabel(context, source, path), count: pagesIn(child) };
      if (name !== next) return withListLink(context, page, source, path, node);
      if (focus.entity === undefined && path.length === focus.way.length) {
        return { ...node, current: true };
      }
      return {
        ...withListLink(context, page, source, path, node),
        children: nodesOf(context, page, source, child, path, focus),
      };
    });
  const pages = [...folder.pages]
    .sort((a, b) => byCodeUnit(a.file, b.file) || byCodeUnit(a.entity.id, b.entity.id))
    .map(({ entity: note }): SpaceNode => {
      if (note.id !== focus.entity?.id)
        return { label: note.title, href: entityHref(page, note.id) };
      const under = underOf(context, page, note);
      return {
        label: note.title,
        current: true,
        ...(under.length === 0 ? {} : { children: under }),
        ...(focus.passages === undefined ? {} : { passages: focus.passages }),
      };
    });
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

/** The head of the tree of a space from `page`: its title, its initials and the link to its page, over the nodes given. */
export function spaceTreeOf(
  context: SiteContext,
  page: string,
  source: string,
  nodes: SpaceNode[],
): SpaceTree {
  return {
    name: spaceTitle(context, source),
    initials: spaceInitials(context, source),
    href: spaceHref(page, source),
    nodes,
  };
}

/** The tree of the space of an entity: its source, the folders on the way to the page open, the page marked as current, every folder linked to its list. */
export function spaceOf(context: SiteContext, page: string, entity: Entity): SpaceTree {
  const source = entity.source.name;
  return spaceTreeOf(
    context,
    page,
    source,
    nodesOf(context, page, source, treeOf(context, source), [], {
      way: foldersOf(entity.source.path),
      entity,
    }),
  );
}

/** Where a page without a file stands in its space: the folders on its way, and how many passages use the word. */
export interface Filing {
  /** The folders on the way, as written on the paths; none files the page at the root. */
  folders: readonly string[];
  passages: number;
}

/**
 * The tree of a space for a page that has no file in it: the keyword page of an expression,
 * filed under `<slug>.md` in the folder given, the folders on the way open, so that the word
 * stands among the notes as the current page, at the place a note of that name would take,
 * its passage count after its name.
 */
export function spaceWithPageOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  source: string,
  filing: Filing,
): SpaceTree {
  const root = treeOf(context, source);
  let folder = root;
  for (const name of filing.folders) {
    folder = folderIn(folder.folders, name);
  }
  folder.pages.push({ file: `${entity.id.slice(entity.id.lastIndexOf("/") + 1)}.md`, entity });
  return spaceTreeOf(
    context,
    page,
    source,
    nodesOf(context, page, source, root, [], {
      way: filing.folders,
      entity,
      passages: filing.passages,
    }),
  );
}

/** The tree of a space from the list of one of its folders: the folders on the way open, that folder marked as the current page and closed. */
export function folderTreeOf(
  context: SiteContext,
  page: string,
  source: string,
  folders: readonly string[],
): SpaceTree {
  return spaceTreeOf(
    context,
    page,
    source,
    nodesOf(context, page, source, treeOf(context, source), [], { way: folders }),
  );
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
    .map(([name, count]) => ({ name, initials: spaceInitials(context, name), count }));
}

/** The spaces as the drawer of a page links them: each to its own page, by its title. */
export function spaceLinksOf(
  context: SiteContext,
  page: string,
  spaces: readonly SpaceCount[],
): SpaceLink[] {
  return spaces.map(({ name, initials, count }) => ({
    label: spaceTitle(context, name),
    href: spaceHref(page, name),
    initials,
    count,
  }));
}

/** A step of the breadcrumb for a folder of a space, named by the folders on its way: linked to its list from `page` when it has one. */
export function folderCrumb(
  context: SiteContext,
  page: string,
  source: string,
  folders: readonly string[],
): BreadcrumbItem {
  const label = folderLabel(context, source, folders);
  const target = categoryPagePathOf(context, source, folders);
  return target === undefined ? { label } : { label, href: relativeHref(page, target) };
}

/** Space › folders › page: the space links to its page, every folder to its list when it has one, the page is the current one. */
export function breadcrumbOf(context: SiteContext, page: string, entity: Entity): BreadcrumbItem[] {
  const source = entity.source.name;
  const folders = foldersOf(entity.source.path);
  return [
    { label: spaceTitle(context, source), href: spaceHref(page, source) },
    ...folders.map((_, index) => folderCrumb(context, page, source, folders.slice(0, index + 1))),
    { label: entity.title },
  ];
}
