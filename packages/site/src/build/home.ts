import type { Entity } from "@concordance-wiki/core";
import { formatMessage, formatRelative, type Catalogue } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import { pluralForms } from "../search/build.js";
import type {
  HomeAlert,
  HomeChange,
  HomeLabels,
  HomeProps,
  HomeSpace,
  Link,
  SuggestionLabels,
} from "../slots.js";
import { citations, message, spaceTitle, type SiteContext } from "./context.js";
import { entityHref, HOME_PAGE, spaceHref } from "./paths.js";
import { spaceInitials } from "./space.js";

/** The most cited words offered as shortcuts next to the search field: one line of chips. */
export const HOME_SHORTCUTS = 5;
/** The spaces in view; the others fold behind a line counting them. */
export const HOME_SPACES_SHOWN = 5;
/** The latest changes the home page lists. */
export const HOME_RECENT = 4;
/** Days without a change after which a source is dormant when `staleness.warn_after_days` says nothing. */
export const DEFAULT_WARN_AFTER_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the shortcuts rank by: the links pointing at a note, the occurrences of a keyword page. */
export function mentionCount(context: SiteContext, entity: Entity): number {
  if (entity.keyword !== true) {
    return citations(context, entity.id);
  }
  const occurrences = entity.attributes["occurrences"];
  return typeof occurrences === "number" ? occurrences : 0;
}

/**
 * The most cited pages first, the identifier breaking ties, one page per title: two pages of the
 * same title would read as one chip twice, so the most cited of them stands for both; a page
 * nobody cites is left out.
 */
export function shortcutsOf(context: SiteContext): Link[] {
  const titles = new Set<string>();
  return [...context.model.entities]
    .map((entity) => ({ entity, count: mentionCount(context, entity) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || byCodeUnit(a.entity.id, b.entity.id))
    .filter(({ entity }) => {
      if (titles.has(entity.title)) return false;
      titles.add(entity.title);
      return true;
    })
    .slice(0, HOME_SHORTCUTS)
    .map(({ entity }) => ({ label: entity.title, href: entityHref(HOME_PAGE, entity.id) }));
}

/** The notes of the model: every entity with a file of its own, so every entity but the keyword pages. */
export function notesOf(context: SiteContext): Entity[] {
  return context.model.entities.filter((entity) => entity.keyword !== true);
}

/** The names of every source, declared in the build block or met on a note, sorted. */
export function sourceNames(context: SiteContext): string[] {
  const names = new Set(context.model.build.sources.map((source) => source.name));
  for (const note of notesOf(context)) {
    names.add(note.source.name);
  }
  return [...names].sort(byCodeUnit);
}

export function instant(iso: string): number {
  return Date.parse(iso);
}

/** A change worded relative to the build instant, "2 days ago", so that two builds of the same corpus agree. */
export function ago(context: SiteContext, iso: string): string {
  return formatRelative(
    context.locale ?? context.language,
    new Date(iso),
    new Date(context.model.build.at),
  );
}

/** The newest `last_modified` among the notes of every source, by source name. */
export function newestChanges(context: SiteContext): Map<string, string> {
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

/** The days without a change after which a source is dormant: its own threshold, the default one or 180 days. */
export function warnAfterDays(context: SiteContext, source: string): number {
  const thresholds = context.staleness?.warn_after_days ?? {};
  return thresholds[source] ?? thresholds["default"] ?? DEFAULT_WARN_AFTER_DAYS;
}

/** Whether a source that last changed at `newest` is dormant at the build instant. */
export function isDormant(context: SiteContext, source: string, newest: string): boolean {
  return (
    instant(context.model.build.at) - instant(newest) > warnAfterDays(context, source) * DAY_MS
  );
}

/** Whether a note stands for a converted document: a deck, a transcript, a PDF merged with it, never an operation of a contract. */
export function hasDocument(entity: Entity): boolean {
  return (entity.representations ?? []).some(
    (representation) => representation.format !== "markdown" && representation.kind === undefined,
  );
}

/** The days elapsed between a change and the build instant, whole days only. */
export function daysSince(context: SiteContext, iso: string): number {
  return Math.floor((instant(context.model.build.at) - instant(iso)) / DAY_MS);
}

/** The names of every source, the most cited first: the sum of the citations of its notes, the name breaking ties. */
export function rankedSourceNames(context: SiteContext): string[] {
  const notes = notesOf(context);
  return sourceNames(context)
    .map((name) => ({
      name,
      cited: notes
        .filter((note) => note.source.name === name)
        .reduce((total, note) => total + citations(context, note.id), 0),
    }))
    .sort((a, b) => b.cited - a.cited || byCodeUnit(a.name, b.name))
    .map(({ name }) => name);
}

/**
 * Every space of the site, the most cited first: a source with its initials, its page count,
 * counted in documents when its notes mostly stand for converted documents, the date of its
 * newest change worded relative to the build, whether it is dormant, and the href of its page.
 */
export function spacesOf(context: SiteContext): HomeSpace[] {
  const newest = newestChanges(context);
  const notes = notesOf(context);
  return rankedSourceNames(context).map((name) => {
    const own = notes.filter((note) => note.source.name === name);
    const documents = own.filter(hasDocument).length;
    const changed = newest.get(name);
    const unit = documents * 2 > own.length ? "documents" : "pages";
    const space: HomeSpace = {
      name: spaceTitle(context, name),
      source: name,
      href: spaceHref(HOME_PAGE, name),
      initials: spaceInitials(context, name),
      count: own.length,
      unit,
      countLabel: formatMessage(context.catalogue, `home.${unit}`, { count: own.length }),
      stale: changed !== undefined && isDormant(context, name, changed),
    };
    if (changed !== undefined) {
      space.date = changed.slice(0, 10);
      space.dateLabel = ago(context, changed);
    }
    return space;
  });
}
/** The notes changed last, newest first then by identifier, each with its space and its change worded relative to the build. */
export function recentOf(context: SiteContext): HomeChange[] {
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
      space: spaceTitle(context, entity.source.name),
      date: changed.slice(0, 10),
      dateLabel: ago(context, changed),
    }));
}

/** One alert per dormant space, in the order of the spaces: how long it has not moved, and the threshold that flags it. */
export function alertsOf(context: SiteContext, spaces: readonly HomeSpace[]): HomeAlert[] {
  const newest = newestChanges(context);
  return spaces.flatMap((space) => {
    const source = space.source ?? space.name;
    const changed = newest.get(source);
    if (changed === undefined || !isDormant(context, source, changed)) return [];
    const days = daysSince(context, changed);
    return [
      {
        title: formatMessage(context.catalogue, "home.stale", { count: days }),
        space: space.name,
        text: formatMessage(context.catalogue, "home.staleThreshold", {
          space: space.name,
          count: warnAfterDays(context, source),
        }),
      },
    ];
  });
}

/** The strings of the home page in the site language, the folded spaces counted. */
export function homeLabels(context: SiteContext, folded: number): HomeLabels {
  return {
    question: message(context, "home.question"),
    explanation: message(context, "home.explanation"),
    mostCited: message(context, "home.mostCited"),
    spaces: message(context, "site.spaces"),
    spacesLead: message(context, "home.spacesLead"),
    moreSpaces: formatMessage(context.catalogue, "home.moreSpaces", { count: folded }),
    datesNote: message(context, "home.datesNote"),
    recent: message(context, "home.recent"),
  };
}

/** The strings of the live results under a search field, the plurals frozen by category as the entity table does. */
export function suggestionLabels(catalogue: Catalogue): SuggestionLabels {
  return {
    matches: pluralForms(catalogue, "home.matches"),
    usedIn: pluralForms(catalogue, "home.usedIn"),
    typeSummary: formatMessage(catalogue, "home.typeSummary"),
    glossaryTerm: pluralForms(catalogue, "home.glossaryTerm"),
    browse: formatMessage(catalogue, "home.browse"),
    enter: formatMessage(catalogue, "home.enterKey"),
    open: formatMessage(catalogue, "home.open"),
    seeResults: pluralForms(catalogue, "home.seeResults"),
  };
}

/** The view model of the home page; the search field is added by the site, which knows where the index lives. */
export function homeOf(context: SiteContext): HomeProps {
  const spaces = spacesOf(context);
  const folded = spaces.slice(HOME_SPACES_SHOWN);
  return {
    shortcuts: shortcutsOf(context),
    spaces: spaces.slice(0, HOME_SPACES_SHOWN),
    ...(folded.length === 0 ? {} : { moreSpaces: folded }),
    recent: recentOf(context),
    alerts: alertsOf(context, spaces),
    labels: homeLabels(context, folded.length),
  };
}
