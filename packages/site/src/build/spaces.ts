import type { Entity } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  SpaceCategory,
  SpaceChange,
  SpaceLabels,
  SpaceProps,
  SpaceRow,
  SpacesLabels,
  SpacesProps,
  SpaceWord,
} from "../slots.js";
import { listedCategoriesOf } from "./category.js";
import { labelIn, message, spaceTitle, typeLabel, type SiteContext } from "./context.js";
import {
  ago,
  daysSince,
  DEFAULT_WARN_AFTER_DAYS,
  instant,
  isDormant,
  newestChanges,
  notesOf,
  rankedSourceNames,
} from "./home.js";
import { entityHref, relativeHref, SPACES_PAGE, spacePagePath } from "./paths.js";
import {
  categoryOf,
  categoryPagePathOf,
  folderDescription,
  folderLabel,
  spaceInitials,
  topFoldersOf,
} from "./space.js";

/** The latest changes a space page lists. */
export const SPACE_RECENT = 4;
/** The most cited words a space page offers. */
export const SPACE_WORDS = 5;
/** How many of its dominant types stand for the content of a space that declares no description. */
export const SPACE_CONTENT_TYPES = 3;

/** The notes of one space. */
function ownNotes(context: SiteContext, source: string): Entity[] {
  return notesOf(context).filter((note) => note.source.name === source);
}

/**
 * What a space holds, in one line: the sentence its source declares, else the labels of its
 * dominant types, the most frequent first, three at most; empty for a space without a note.
 */
export function contentOf(context: SiteContext, source: string): string {
  const declared = context.sourceDescriptions?.[source];
  if (declared !== undefined) return declared;
  const counts = new Map<string, number>();
  for (const note of ownNotes(context, source)) {
    counts.set(note.type, (counts.get(note.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || byCodeUnit(a, b))
    .slice(0, SPACE_CONTENT_TYPES)
    .map(([type]) => typeLabel(context, type))
    .join(", ");
}

/** A dormant space says its age in days, "193 days ago", so that the accent is doubled by a number. */
export function daysAgo(context: SiteContext, iso: string): string {
  return new Intl.RelativeTimeFormat(context.locale ?? context.language, {
    numeric: "always",
  }).format(-daysSince(context, iso), "day");
}

/** Every space of the site as the spaces page lists them, the most cited first, dated from the git history. */
export function spaceRowsOf(context: SiteContext): SpaceRow[] {
  const newest = newestChanges(context);
  return rankedSourceNames(context).map((name) => {
    const changed = newest.get(name);
    const stale = changed !== undefined && isDormant(context, name, changed);
    const row: SpaceRow = {
      name: spaceTitle(context, name),
      href: relativeHref(SPACES_PAGE, spacePagePath(name)),
      initials: spaceInitials(context, name),
      content: contentOf(context, name),
      count: ownNotes(context, name).length,
      stale,
    };
    if (changed !== undefined) {
      row.date = changed.slice(0, 10);
      row.dateLabel = stale ? daysAgo(context, changed) : ago(context, changed);
    }
    return row;
  });
}

/** The strings of the spaces page in the site language, the spaces counted and the default threshold named. */
export function spacesLabels(context: SiteContext, count: number): SpacesLabels {
  return {
    title: message(context, "site.spaces"),
    lead: formatMessage(context.catalogue, "spaces.lead", { count }),
    space: message(context, "spaces.space"),
    content: message(context, "spaces.content"),
    pages: message(context, "spaces.pages"),
    lastUpdate: message(context, "spaces.lastUpdate"),
    datesNote: formatMessage(context.catalogue, "spaces.datesNote", {
      count: DEFAULT_WARN_AFTER_DAYS,
    }),
    stale: message(context, "spaces.stale"),
  };
}

/** The view model of the spaces page. */
export function spacesPageOf(context: SiteContext): SpacesProps {
  const spaces = spaceRowsOf(context);
  return { spaces, labels: spacesLabels(context, spaces.length) };
}

/** The sentence of a folder card: the one the configuration gives the folder, else the description of the type its list maps to; none without either. */
function categoryDescriptionOf(
  context: SiteContext,
  source: string,
  name: string,
): string | undefined {
  const declared = folderDescription(context, source, [name]);
  if (declared !== undefined) return declared;
  const type = listedCategoriesOf(context).find(
    (category) => category.source === source && category.folders.join("/") === name,
  )?.type;
  const description = type === undefined ? undefined : context.profile.types[type]?.description;
  return description === undefined ? undefined : labelIn(description, context.language);
}

/**
 * The categories of a space: its top-level folders by their titles, with the sentence the
 * configuration gives them or the description of their type, each linking to its list, or,
 * for a folder whose address a note takes, to the page the tree lists first under it, where
 * the tree opens on the folder.
 */
export function categoriesOf(context: SiteContext, page: string, source: string): SpaceCategory[] {
  return topFoldersOf(context, source).map(({ name, count, first }) => {
    const list = categoryPagePathOf(context, source, [name]);
    const description = categoryDescriptionOf(context, source, name);
    return {
      label: folderLabel(context, source, [name]),
      href: list === undefined ? entityHref(page, first.id) : relativeHref(page, list),
      ...(description === undefined ? {} : { description }),
      count,
    };
  });
}

/** The notes of a space changed last, newest first then by identifier, each with its category. */
export function spaceRecentOf(context: SiteContext, page: string, source: string): SpaceChange[] {
  return ownNotes(context, source)
    .flatMap((entity) => {
      const changed = entity.source.last_modified;
      return changed === undefined ? [] : [{ entity, changed }];
    })
    .sort((a, b) => instant(b.changed) - instant(a.changed) || byCodeUnit(a.entity.id, b.entity.id))
    .slice(0, SPACE_RECENT)
    .map(({ entity, changed }) => {
      const category = categoryOf(entity.source.path);
      return {
        label: entity.title,
        href: entityHref(page, entity.id),
        ...(category === undefined ? {} : { category: folderLabel(context, source, [category]) }),
        date: changed.slice(0, 10),
        dateLabel: ago(context, changed),
      };
    });
}

/**
 * How many times the notes of a space cite a page: the links from those notes for a note, the
 * passages read in the space for a keyword page.
 */
export function citedInSpace(context: SiteContext, source: string, entity: Entity): number {
  if (entity.keyword === true) {
    return (context.fragments.get(entity.id)?.passages ?? []).filter(
      (passage) => passage.source === source,
    ).length;
  }
  return (context.incoming.get(entity.id) ?? []).filter(
    (link) => context.entities.get(link.from)?.source.name === source,
  ).length;
}

/** The pages the notes of a space cite most, the identifier breaking ties, five at most; a page they never cite is left out. */
export function spaceWordsOf(context: SiteContext, page: string, source: string): SpaceWord[] {
  return [...context.model.entities]
    .map((entity) => ({ entity, count: citedInSpace(context, source, entity) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || byCodeUnit(a.entity.id, b.entity.id))
    .slice(0, SPACE_WORDS)
    .map(({ entity, count }) => ({
      label: entity.title,
      href: entityHref(page, entity.id),
      count,
      ...(entity.keyword === true
        ? {
            keyword: true,
            title: formatMessage(context.catalogue, "entity.markNoNote", { count }),
          }
        : {}),
    }));
}

/** The repository a space is fed by: the last segment of the URL the build recorded, else the name of the source. */
export function repositoryOf(context: SiteContext, source: string): string {
  const url = context.model.build.sources.find((candidate) => candidate.name === source)?.url;
  return /([^/]+?)(?:\.git)?\/*$/.exec(url ?? "")?.[1] ?? source;
}

/** The strings of a space page in the site language, the counts already worded. */
export function spaceLabels(
  context: SiteContext,
  counts: { pages: number; categories: number },
  changed: string | undefined,
): SpaceLabels {
  return {
    breadcrumb: message(context, "entity.breadcrumb"),
    spaces: message(context, "site.spaces"),
    pages: formatMessage(context.catalogue, "home.pages", { count: counts.pages }),
    repository: message(context, "space.repository"),
    ...(changed === undefined
      ? {}
      : {
          updated: formatMessage(context.catalogue, "space.updated", {
            when: ago(context, changed),
          }),
        }),
    browse: message(context, "space.browse"),
    categoriesLead: formatMessage(context.catalogue, "space.categoriesLead", {
      count: counts.categories,
    }),
    categoriesNote: message(context, "space.categoriesNote"),
    recent: message(context, "home.recent"),
    mostCited: message(context, "space.mostCited"),
    wordsNote: message(context, "space.wordsNote"),
    footer: message(context, "space.footer"),
  };
}

/** The view model of the page of one space; the search field is added by the site, which knows where the index lives. */
export function spacePageOf(context: SiteContext, source: string): SpaceProps {
  const page = spacePagePath(source);
  const changed = newestChanges(context).get(source);
  const description = context.sourceDescriptions?.[source];
  const categories = categoriesOf(context, page, source);
  const count = ownNotes(context, source).length;
  return {
    name: spaceTitle(context, source),
    initials: spaceInitials(context, source),
    ...(description === undefined ? {} : { description }),
    spacesHref: relativeHref(page, SPACES_PAGE),
    repository: repositoryOf(context, source),
    count,
    ...(changed === undefined ? {} : { date: changed.slice(0, 10) }),
    categories,
    recent: spaceRecentOf(context, page, source),
    words: spaceWordsOf(context, page, source),
    labels: spaceLabels(context, { pages: count, categories: categories.length }, changed),
  };
}
