import type { SlotProps, SpaceRow } from "../slots.js";
import { MARK_SVG } from "./fixtures.js";

/** A row of the spaces page of the corporate state; the content is what the configuration declares, or the dominant types. */
function row(
  name: string,
  initials: string,
  content: string,
  count: number,
  date: string,
  dateLabel: string,
  stale = false,
): SpaceRow {
  return { name, href: `../${name}/`, initials, content, count, date, dateLabel, stale };
}

/**
 * The spaces page of the corporate state: the seven spaces of the fixtures corpus, the five
 * of the home page and the two it folds, none truncated, the dormant one dated in days.
 */
export const corporateSpaces: SlotProps["Spaces"] = {
  spaces: [
    row(
      "glossary",
      "GL",
      "The vocabulary of the tool: one note per term, with its aliases and its homonyms.",
      48,
      "2026-09-11",
      "2 days ago",
    ),
    row(
      "specs",
      "SP",
      "Screens, rules, objects, processes and interfaces of the tool.",
      57,
      "2026-09-09",
      "4 days ago",
    ),
    row("meetings", "ME", "Meeting", 12, "2026-09-12", "yesterday"),
    row("decisions", "DE", "Decision", 8, "2026-09-01", "12 days ago"),
    row("framing", "FR", "Document", 4, "2026-03-03", "194 days ago", true),
    row("briefs", "BR", "Document", 3, "2026-08-20", "3 weeks ago"),
    row("runbooks", "RU", "Runbook", 2, "2026-07-30", "last month"),
  ],
  labels: {
    title: "Spaces",
    lead: "7 spaces, fed by the repositories declared in the configuration. A repository may carry several spaces, and a space may spread over several repositories.",
    space: "Space",
    content: "Content",
    pages: "Pages",
    lastUpdate: "Last update",
    datesNote:
      "The dates come from the git history, so they are always exact. A space past the freshness threshold — 180 days by default — is marked in accent, the only case where colour carries an alert, doubled by the value in days.",
  },
};

/**
 * The page of the specifications space of the corporate state: its categories are the folders
 * of the fixtures corpus with their counts, its recent changes and its vocabulary counted in
 * the space only.
 */
export const corporateSpace: SlotProps["Space"] = {
  name: "specs",
  initials: "SP",
  description: "Screens, rules, objects, processes and interfaces of the tool.",
  spacesHref: "../spaces/",
  repository: "demo-specs",
  count: 57,
  date: "2026-09-09",
  categories: [
    { label: "api", href: "api/", count: 3 },
    { label: "batches", href: "batches/", count: 3 },
    { label: "endpoints", href: "endpoints/", count: 6 },
    { label: "objects", href: "objects/", count: 12 },
    { label: "processes", href: "processes/", count: 5 },
    { label: "roles", href: "roles/", count: 3 },
    { label: "rules", href: "rules/", count: 10 },
    { label: "screens", href: "screens/", count: 11 },
    { label: "tables", href: "tables/", count: 4 },
  ],
  recent: [
    {
      label: "Publication threshold",
      href: "rules/publication-threshold/",
      category: "rules",
      date: "2026-09-09",
      dateLabel: "4 days ago",
    },
    {
      label: "Mentions panel",
      href: "screens/mentions-panel/",
      category: "screens",
      date: "2026-09-04",
      dateLabel: "9 days ago",
    },
    {
      label: "Model query",
      href: "api/model-query/",
      category: "api",
      date: "2026-09-04",
      dateLabel: "9 days ago",
    },
    {
      label: "Entity",
      href: "objects/entity/",
      category: "objects",
      date: "2026-08-28",
      dateLabel: "2 weeks ago",
    },
  ],
  words: [
    { label: "Entity", href: "../glossary/inference/entity/", count: 42 },
    { label: "Source", href: "../glossary/ingestion/source/", count: 31 },
    { label: "Finding", href: "../glossary/quality/finding/", count: 24 },
    { label: "Publication threshold", href: "rules/publication-threshold/", count: 17 },
    { label: "build summary", href: "../keywords/build-summary/", count: 6, keyword: true },
  ],
  labels: {
    breadcrumb: "You are here",
    spaces: "Spaces",
    pages: "57 pages",
    repository: "repository",
    updated: "updated 4 days ago",
    browse: "Browse",
    categoriesLead: "9 categories, as filed in the repository",
    categoriesNote:
      "Each category opens its own list. The tree on the left appears only once in a page, so that nothing has to be unfolded from the home page.",
    recent: "Recently changed",
    mostCited: "The most cited words here",
    wordsNote: "Counted in this space only, which gives its own vocabulary.",
    footer:
      "A space reads like a small wiki within the wiki: its own search, its own vocabulary, its own news.",
  },
};

/** The top bar of a space page: the corporate one without a tree in its drawer, its search field saying it keeps to the space and carrying it as the source facet. */
export const corporateSpaceHeader: SlotProps["Header"] = {
  siteTitle: "Concordance documentation",
  homeHref: "../",
  logo: { svg: MARK_SVG },
  spaces: {
    label: "Spaces",
    href: "../spaces/",
    items: [
      { label: "glossary", href: "../glossary/", initials: "GL", count: 48 },
      { label: "specs", href: "../specs/", initials: "SP", count: 57 },
    ],
  },
  navigation: [
    { label: "A–Z index", href: "../index/" },
    { label: "Recent", href: "../#home-recent" },
  ],
  search: { action: "../search/", placeholder: "Search in this space", source: "specs" },
};
