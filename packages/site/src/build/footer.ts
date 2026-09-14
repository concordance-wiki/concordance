import type { AccessibilityStatus, Entity, LegalConfig } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { FooterLabels, FooterProps, Link } from "../slots.js";
import { message, type SiteContext } from "./context.js";
import { notesOf, sourceNames } from "./home.js";
import { entityHref, relativeHref, SPACES_PAGE, TODO_PAGE } from "./paths.js";

/** The three pages the organisation may declare, in the order the footer lists them. */
export const LEGAL_PAGES = ["mentions", "accessibility", "privacy"] as const;

export type LegalPage = (typeof LEGAL_PAGES)[number];

/** The path, in a source, of the note that stands for a legal page when the configuration names no address. */
export function legalNotePath(page: LegalPage): string {
  return `legal/${page}.md`;
}

/** The note filed at `legal/<page>.md` in a source, the first source by name when several carry one; none when no source does. */
export function legalNoteOf(context: SiteContext, page: LegalPage): Entity | undefined {
  const path = legalNotePath(page);
  return notesOf(context)
    .filter((note) => note.source.path === path)
    .sort((a, b) => byCodeUnit(a.source.name, b.source.name))[0];
}

/** The compliance an accessibility statement declares, in the words of the site. */
export function accessibilityStatusLabel(
  context: SiteContext,
  status: AccessibilityStatus,
): string {
  switch (status) {
    case "compliant":
      return message(context, "footer.compliant");
    case "non-compliant":
      return message(context, "footer.nonCompliant");
    case "partially-compliant":
      return message(context, "footer.partiallyCompliant");
  }
}

/** The label of a legal page in the footer; the accessibility link carries the declared state when the configuration gives one. */
function legalLabel(context: SiteContext, page: LegalPage, legal: LegalConfig): string {
  if (page === "accessibility") {
    return legal.accessibility_status === undefined
      ? message(context, "footer.accessibility")
      : formatMessage(context.catalogue, "footer.accessibilityWith", {
          status: accessibilityStatusLabel(context, legal.accessibility_status),
        });
  }
  return message(context, page === "mentions" ? "footer.mentions" : "footer.privacy");
}

/** The address of a legal page from `page`: the one the configuration declares, else the note at `legal/<page>.md`; none without either. */
function legalHref(
  context: SiteContext,
  page: string,
  legalPage: LegalPage,
  legal: LegalConfig,
): string | undefined {
  const declared = legal[`${legalPage}_url`];
  if (declared !== undefined) return declared;
  const note = legalNoteOf(context, legalPage);
  return note === undefined ? undefined : entityHref(page, note.id);
}

/**
 * The links of the footer to the pages only the organisation can declare, from `page`: the
 * legal notice, the accessibility statement with its declared state, the personal data page,
 * each present only when the configuration names its address or a note stands for it. Nothing
 * is assumed: a state that was not declared is not shown.
 */
export function legalLinksOf(context: SiteContext, page: string): Link[] {
  const legal = context.legal ?? {};
  return LEGAL_PAGES.flatMap((legalPage): Link[] => {
    const href = legalHref(context, page, legalPage, legal);
    return href === undefined ? [] : [{ label: legalLabel(context, legalPage, legal), href }];
  });
}

/** How many pages the site holds, as the build line counts them: the notes, every entity with a file of its own. */
export function pageCountOf(context: SiteContext): number {
  return notesOf(context).length;
}

/** The profile with its version, `default@1`, as the build line names it. */
export function profileLabelOf(context: SiteContext): string {
  return `${context.profile.profile ?? "default"}@${String(context.profile.version)}`;
}

/** The strings of the footer in the site language, the build instant and the counts set in. */
export function footerLabels(context: SiteContext): FooterLabels {
  const at = new Date(context.model.build.at);
  return {
    thisSite: message(context, "footer.thisSite"),
    published: formatMessage(context.catalogue, "footer.published", { day: at, time: at }),
    sources: message(context, "footer.sources"),
    builtWith: message(context, "footer.builtWith"),
    generator: message(context, "footer.generator"),
    licence: message(context, "footer.licence"),
    content: message(context, "footer.content"),
    declared: message(context, "footer.declared"),
    publication: message(context, "footer.publication"),
    buildAt: formatMessage(context.catalogue, "footer.buildAt", { day: at, time: at }),
    profile: formatMessage(context.catalogue, "footer.profile", {
      profile: profileLabelOf(context),
    }),
    pages: formatMessage(context.catalogue, "footer.pages", { count: pageCountOf(context) }),
  };
}

/** What the theme of the project declares for the footer: a paragraph, links and whether the tool is credited. */
export interface FooterTheme {
  text?: string;
  links?: Link[];
  credit: boolean;
}

/**
 * The footer of one page, every href relative to it: what the tool knows, the repositories
 * counted and linked to the spaces page, the profile and the page count; then
 * what the organisation declared, the legal pages before the links of the theme; the to-do
 * page with its count, a build statistic kept out of the top bar.
 */
export function footerOf(
  context: SiteContext,
  page: string,
  theme: FooterTheme,
  todoCount: number,
): FooterProps {
  const repositories = sourceNames(context).length;
  const footer: FooterProps = {
    version: context.model.build.tool,
    generatedAt: context.model.build.at,
    repositories: {
      count: repositories,
      href: relativeHref(page, SPACES_PAGE),
      label: formatMessage(context.catalogue, "footer.repositories", { count: repositories }),
    },
    profile: profileLabelOf(context),
    pages: pageCountOf(context),
    links: [...legalLinksOf(context, page), ...(theme.links ?? [])],
    todo: {
      label: message(context, "site.todo"),
      href: relativeHref(page, TODO_PAGE),
      count: todoCount,
    },
    credit: theme.credit,
    labels: footerLabels(context),
  };
  if (theme.text !== undefined) {
    footer.text = theme.text;
  }
  return footer;
}
