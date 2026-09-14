import { formatMessage, formatNumber } from "@concordance-wiki/i18n";

import { renderMarkdown } from "../markdown/render.js";
import type { AboutFigure, AboutLabels, AboutProps, AboutSource } from "../slots.js";
import { message, type SiteContext } from "./context.js";
import { pageCountOf } from "./footer.js";
import {
  ago,
  hasDocument,
  isDormant,
  newestChanges,
  notesOf,
  rankedSourceNames,
  warnAfterDays,
} from "./home.js";
import { ABOUT_PAGE, HOME_PAGE, relativeHref, TODO_PAGE } from "./paths.js";
import { contentOf, daysAgo } from "./spaces.js";

/** Occurrences a word needs before it gets a page when the configuration says nothing: the default of `inference.keyword_pages.min_occurrences`. */
export const DEFAULT_KEYWORD_THRESHOLD = 3;

/** How many characters of a commit the version column shows. */
export const SHORT_COMMIT = 7;

/** What a source holds, in one word or three: its title when the configuration gives one, else the labels of its dominant types. */
export function natureOf(context: SiteContext, source: string): string {
  const title = context.names?.sources?.[source];
  return title ?? contentOf(context, source);
}

/**
 * Every source of the site as the about page lists them, the most cited first: the repository,
 * what it holds, the commit the build read, how many pages or documents the site kept from it
 * and its newest change from the git history, in days once past the freshness threshold.
 */
export function aboutSourcesOf(context: SiteContext): AboutSource[] {
  const newest = newestChanges(context);
  const notes = notesOf(context);
  return rankedSourceNames(context).map((name) => {
    const own = notes.filter((note) => note.source.name === name);
    const documents = own.filter(hasDocument).length;
    const unit = documents * 2 > own.length ? "documents" : "pages";
    const commit = context.model.build.sources.find((source) => source.name === name)?.commit;
    const changed = newest.get(name);
    const stale = changed !== undefined && isDormant(context, name, changed);
    const source: AboutSource = {
      name,
      nature: natureOf(context, name),
      content: formatMessage(context.catalogue, `home.${unit}`, { count: own.length }),
      stale,
    };
    if (commit !== undefined) {
      source.version = commit.slice(0, SHORT_COMMIT);
    }
    if (changed !== undefined) {
      source.date = changed.slice(0, 10);
      source.dateLabel = stale ? daysAgo(context, changed) : ago(context, changed);
    }
    if (stale) {
      const threshold = warnAfterDays(context, name);
      source.threshold = threshold;
      source.staleNote = formatMessage(context.catalogue, "about.staleExceeds", {
        count: threshold,
      });
    }
    return source;
  });
}

/** The figures at the head of the about page: the build instant, the pages and the indexed words; no duration, which the model does not record so that two builds of the same sources agree. */
export function aboutFiguresOf(context: SiteContext): AboutFigure[] {
  const at = new Date(context.model.build.at);
  const locale = context.locale ?? context.language;
  return [
    {
      label: message(context, "about.publishedOn"),
      value: formatMessage(context.catalogue, "about.publishedAt", { day: at, time: at }),
    },
    { label: message(context, "about.pages"), value: formatNumber(locale, pageCountOf(context)) },
    {
      label: message(context, "about.words"),
      value: formatNumber(locale, context.model.entities.length),
    },
  ];
}

/** The strings of the about page in the site language, the threshold already worded where a sentence names it. */
export function aboutLabels(context: SiteContext, threshold: number): AboutLabels {
  return {
    home: message(context, "site.home"),
    breadcrumb: message(context, "entity.breadcrumb"),
    title: message(context, "about.title"),
    lead: message(context, "about.lead"),
    publishedOn: message(context, "about.publishedOn"),
    pages: message(context, "about.pages"),
    words: message(context, "about.words"),
    sources: message(context, "about.sources"),
    sourcesLead: message(context, "about.sourcesLead"),
    repository: message(context, "about.repository"),
    nature: message(context, "about.nature"),
    version: message(context, "about.version"),
    content: message(context, "about.content"),
    lastChange: message(context, "about.lastChange"),
    versionsNote: message(context, "about.versionsNote"),
    staleSource: message(context, "about.staleSource"),
    stale: message(context, "spaces.stale"),
    notContained: message(context, "about.notContained"),
    notContainedText: formatMessage(context.catalogue, "about.notContainedText", {
      count: threshold,
    }),
    report: message(context, "about.report"),
    reportLists: message(context, "about.reportLists"),
    correct: message(context, "about.correct"),
    correctText: message(context, "about.correctText"),
    contribute: message(context, "about.contribute"),
    pseudonymised: message(context, "about.pseudonymised"),
    pseudonymisedText: message(context, "about.pseudonymisedText"),
  };
}

/** The view model of the about page: the figures, the sources, what the site leaves out, how it is corrected, and the sections of the file the configuration names. */
export function aboutOf(context: SiteContext): AboutProps {
  const threshold = context.keywordThreshold ?? DEFAULT_KEYWORD_THRESHOLD;
  const props: AboutProps = {
    homeHref: relativeHref(ABOUT_PAGE, HOME_PAGE),
    generatedAt: context.model.build.at,
    figures: aboutFiguresOf(context),
    sources: aboutSourcesOf(context),
    threshold,
    reportHref: relativeHref(ABOUT_PAGE, TODO_PAGE),
    pseudonymised: context.pseudonymized === true,
    labels: aboutLabels(context, threshold),
  };
  if (context.contributeUrl !== undefined) {
    props.contributeHref = context.contributeUrl;
  }
  if (context.about !== undefined) {
    props.sections = renderMarkdown(context.about).sections;
  }
  return props;
}
