import type { Entity } from "@concordance-wiki/core";
import { formatDate } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { HomeEntry, HomeItem, HomeProps, HomeSource, HomeTreeNode, Link } from "../slots.js";
import { citations, message, type SiteContext } from "./context.js";
import { entityHref, HOME_PAGE, INDEX_PAGE, relativeHref, TODO_PAGE } from "./paths.js";

/** The most cited words offered as shortcuts next to the search field. */
export const HOME_SHORTCUTS = 12;
/** The latest changes the freshness entry lists. */
export const HOME_RECENT = 20;
/** Days without a change after which a source is dormant when `staleness.warn_after_days` says nothing. */
export const DEFAULT_WARN_AFTER_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HomeOptions {
  /** The number of entries of the to-do page, shown on its link. */
  todoCount: number;
  /** The letters of the index that have entries, each leading to its place in the index. */
  letters: HomeItem[];
}

/** What the shortcuts rank by: the links pointing at a note, the occurrences of a keyword page. */
export function mentionCount(context: SiteContext, entity: Entity): number {
  if (entity.keyword !== true) {
    return citations(context, entity.id);
  }
  const occurrences = entity.attributes["occurrences"];
  return typeof occurrences === "number" ? occurrences : 0;
}

/** The most cited pages first, the identifier breaking ties; a page nobody cites is left out. */
export function shortcutsOf(context: SiteContext): Link[] {
  return [...context.model.entities]
    .map((entity) => ({ entity, count: mentionCount(context, entity) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || byCodeUnit(a.entity.id, b.entity.id))
    .slice(0, HOME_SHORTCUTS)
    .map(({ entity }) => ({ label: entity.title, href: entityHref(HOME_PAGE, entity.id) }));
}

/** The notes of the model: every entity with a file of its own, so every entity but the keyword pages. */
function notesOf(context: SiteContext): Entity[] {
  return context.model.entities.filter((entity) => entity.keyword !== true);
}

/** The names of every source, declared in the build block or met on a note, sorted. */
function sourceNames(context: SiteContext): string[] {
  const names = new Set(context.model.build.sources.map((source) => source.name));
  for (const note of notesOf(context)) {
    names.add(note.source.name);
  }
  return [...names].sort(byCodeUnit);
}

interface Folder {
  folders: Map<string, Folder>;
  notes: { file: string; entity: Entity }[];
}

function folderIn(folders: Map<string, Folder>, name: string): Folder {
  const known = folders.get(name);
  if (known !== undefined) {
    return known;
  }
  const created: Folder = { folders: new Map(), notes: [] };
  folders.set(name, created);
  return created;
}

function notesIn(contents: Folder): number {
  return [...contents.folders.values()].reduce(
    (total, child) => total + notesIn(child),
    contents.notes.length,
  );
}

function nodeOf(label: string, contents: Folder): HomeTreeNode {
  const folders = [...contents.folders.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, child]) => nodeOf(name, child));
  const notes = [...contents.notes]
    .sort((a, b) => byCodeUnit(a.file, b.file) || byCodeUnit(a.entity.id, b.entity.id))
    .map(({ entity }) => ({ label: entity.title, href: entityHref(HOME_PAGE, entity.id) }));
  return { label, count: notesIn(contents), children: [...folders, ...notes] };
}

/** One node per source, its folders first then its notes at every level, each folder counting its notes. */
export function treeOf(context: SiteContext): HomeTreeNode[] {
  const roots = new Map<string, Folder>();
  for (const name of sourceNames(context)) {
    folderIn(roots, name);
  }
  for (const entity of notesOf(context)) {
    const { path } = entity.source;
    const cut = path.lastIndexOf("/");
    let current = folderIn(roots, entity.source.name);
    for (const segment of cut < 0 ? [] : path.slice(0, cut).split("/")) {
      current = folderIn(current.folders, segment);
    }
    current.notes.push({ file: path.slice(cut + 1), entity });
  }
  return [...roots.entries()].map(([name, contents]) => nodeOf(name, contents));
}

function instant(iso: string): number {
  return Date.parse(iso);
}

function spelled(context: SiteContext, iso: string): string {
  return formatDate(context.locale ?? context.language, new Date(iso), "medium");
}

/** The newest `last_modified` among the notes of every source, by source name. */
function newestChanges(context: SiteContext): Map<string, string> {
  const newest = new Map<string, string>();
  for (const note of notesOf(context)) {
    const changed = note.source.last_modified;
    if (changed === undefined) continue;
    const known = newest.get(note.source.name);
    if (known === undefined || instant(changed) > instant(known)) {
      newest.set(note.source.name, changed);
    }
  }
  return newest;
}

/** Whether a source that last changed at `newest` is dormant at the build instant, by its own threshold or the default one. */
export function isDormant(context: SiteContext, source: string, newest: string): boolean {
  const thresholds = context.staleness?.warn_after_days ?? {};
  const days = thresholds[source] ?? thresholds["default"] ?? DEFAULT_WARN_AFTER_DAYS;
  return instant(context.model.build.at) - instant(newest) > days * DAY_MS;
}

/** Every source with the date of its newest change; a source without a dated note is never dormant. */
export function sourcesOf(context: SiteContext): HomeSource[] {
  const newest = newestChanges(context);
  return sourceNames(context).map((name) => {
    const changed = newest.get(name);
    return changed === undefined
      ? { name, stale: false }
      : {
          name,
          date: changed.slice(0, 10),
          dateLabel: spelled(context, changed),
          stale: isDormant(context, name, changed),
        };
  });
}

/** The notes changed last, newest first then by identifier, each flagged when its source is dormant. */
export function recentOf(context: SiteContext): HomeItem[] {
  const dormant = new Set(
    sourcesOf(context)
      .filter((source) => source.stale)
      .map((source) => source.name),
  );
  return notesOf(context)
    .flatMap((entity) => {
      const changed = entity.source.last_modified;
      return changed === undefined ? [] : [{ entity, changed }];
    })
    .sort((a, b) => instant(b.changed) - instant(a.changed) || byCodeUnit(a.entity.id, b.entity.id))
    .slice(0, HOME_RECENT)
    .map(({ entity, changed }) => ({
      label: entity.title,
      href: entityHref(HOME_PAGE, entity.id),
      date: changed.slice(0, 10),
      dateLabel: spelled(context, changed),
      ...(dormant.has(entity.source.name) ? { stale: true } : {}),
    }));
}

/** The three entry points: the file tree, the letters of the index, the latest changes with the sources. */
export function entriesOf(context: SiteContext, letters: HomeItem[]): HomeEntry[] {
  return [
    { kind: "tree", title: message(context, "home.tree"), items: [], tree: treeOf(context) },
    {
      kind: "index",
      title: message(context, "home.index"),
      href: relativeHref(HOME_PAGE, INDEX_PAGE),
      items: letters,
    },
    {
      kind: "recent",
      title: message(context, "home.recent"),
      items: recentOf(context),
      sources: sourcesOf(context),
    },
  ];
}

/** The view model of the home page; the search field is a slot the search index fills. */
export function homeOf(context: SiteContext, title: string, options: HomeOptions): HomeProps {
  const { build } = context.model;
  return {
    title,
    shortcuts: shortcutsOf(context),
    stats: {
      sources: build.sources.length,
      files: build.sources.reduce((total, source) => total + (source.files ?? 0), 0),
      builtAt: build.at,
      builtAtLabel: formatDate(context.locale ?? context.language, new Date(build.at), "long"),
    },
    entries: entriesOf(context, options.letters),
    todo: {
      label: message(context, "site.todo"),
      href: relativeHref(HOME_PAGE, TODO_PAGE),
      count: options.todoCount,
    },
  };
}
