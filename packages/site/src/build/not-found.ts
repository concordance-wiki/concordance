import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import { pluralForms } from "../search/build.js";
import type { NotFoundProps } from "../slots.js";
import type { AgeNoticeProps } from "../theme/default/age-notice.js";
import { message, type SiteContext } from "./context.js";
import { relativeHref, SEARCH_PAGE, siteRootOf, SPACES_PAGE } from "./paths.js";

/** The page served for a missing address, at the root of the site, where the hosts of static sites look for it. */
export const NOT_FOUND_PAGE = "404.html";

/**
 * The path the site is published under, from its address: `/handbook/` for
 * `https://example.org/handbook`, `/` without an address or for one at the root of its host.
 */
export function sitePathOf(siteUrl: string | undefined): string {
  if (siteUrl === undefined) return "/";
  const path = new URL(siteUrl).pathname;
  return path.endsWith("/") ? path : `${path}/`;
}

/** The address of the page served for a missing address, what its `<base>` names so that its links resolve from wherever it is served. */
export function notFoundBase(siteUrl: string | undefined): string {
  return `${sitePathOf(siteUrl)}${NOT_FOUND_PAGE}`;
}

/** The view model of the page served for a missing address, its hrefs from the root of the site. */
export function notFoundOf(context: SiteContext): NotFoundProps {
  return {
    label: message(context, "notfound.label"),
    title: message(context, "notfound.title"),
    cause: message(context, "notfound.cause"),
    nearbyLabel: message(context, "notfound.nearby"),
    searchHref: relativeHref(NOT_FOUND_PAGE, SEARCH_PAGE),
    searchLabel: message(context, "notfound.searchSite"),
    searchQueryLabel: message(context, "notfound.search"),
    browse: {
      label: message(context, "notfound.browse"),
      href: relativeHref(NOT_FOUND_PAGE, SPACES_PAGE),
    },
    root: siteRootOf(NOT_FOUND_PAGE),
  };
}

/** The repository of the first source the build recorded an address for, in name order; none when no source has one. */
export function repositoryHrefOf(context: SiteContext): string | undefined {
  return [...context.model.build.sources]
    .sort((a, b) => byCodeUnit(a.name, b.name))
    .find((source) => source.url !== undefined)?.url;
}

/**
 * The notice on the age of the site as one page carries it: the publication instant of the
 * model, the cadence the configuration declares, the exits from the page; the island counts
 * the days and shows it past three cadences.
 */
export function ageNoticeOf(context: SiteContext, page: string, everyDays: number): AgeNoticeProps {
  const repositoryHref = repositoryHrefOf(context);
  return {
    publishedAt: context.model.build.at,
    everyDays,
    locale: context.catalogue.locale,
    sourcesHref: relativeHref(page, SPACES_PAGE),
    ...(repositoryHref === undefined ? {} : { repositoryHref }),
    labels: {
      notice: message(context, "age.notice"),
      published: pluralForms(context.catalogue, "age.published"),
      cadence: formatMessage(context.catalogue, "age.cadence", { count: everyDays }),
      missing: message(context, "age.missing"),
      sources: message(context, "age.sources"),
      or: message(context, "age.or"),
      repositories: message(context, "age.repositories"),
      close: message(context, "age.close"),
    },
  };
}
