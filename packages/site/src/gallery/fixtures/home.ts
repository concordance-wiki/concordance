import type { HomeSpace, SlotProps } from "../../slots.js";

export const home: SlotProps["Home"] = {
  search: { action: "search/", placeholder: "Search a word of your business" },
  shortcuts: [
    { label: "entity", href: "glossary/entity/" },
    { label: "source", href: "glossary/source/" },
  ],
  spaces: [
    {
      name: "glossary",
      href: "glossary/",
      initials: "GL",
      count: 2,
      unit: "pages",
      countLabel: "2 pages",
      date: "2024-04-30",
      dateLabel: "yesterday",
      stale: false,
    },
    {
      name: "specs",
      href: "specs/",
      initials: "SP",
      count: 1,
      unit: "pages",
      date: "2024-04-20",
      dateLabel: "11 days ago",
      stale: false,
    },
    {
      name: "rules",
      href: "rules/",
      initials: "RU",
      count: 1,
      unit: "pages",
      date: "2023-01-01",
      stale: true,
    },
    { name: "framing", href: "framing/", initials: "FR", count: 0, unit: "pages", stale: false },
  ],
  recent: [
    {
      label: "Keyword page",
      href: "glossary/keyword-page/",
      space: "glossary",
      date: "2024-04-30",
      dateLabel: "yesterday",
    },
    { label: "Old rule", href: "rules/old-rule/", space: "rules", date: "2023-01-01" },
  ],
  alerts: [
    {
      title: "A space has not moved for 486 days",
      space: "rules",
      text: "rules. The alert threshold is set to 180 days in the configuration.",
    },
  ],
};

/** A space of the corporate home: its row leads to its page. */
function corporateSpace(
  name: string,
  initials: string,
  count: number,
  unit: "pages" | "documents",
  date: string,
  dateLabel: string,
  stale = false,
): HomeSpace {
  return {
    name,
    href: `${name}/`,
    initials,
    count,
    unit,
    countLabel: `${String(count)} ${unit}`,
    date,
    dateLabel,
    stale,
  };
}

/**
 * The home page of the corporate state: the question and the field, five shortcuts on one line,
 * five spaces of the fixtures corpus with two more folded, the four pages changed last, and the
 * alert on the space that has not moved past the threshold.
 */
export const corporateHome: SlotProps["Home"] = {
  search: { action: "search/", placeholder: "Search the documentation" },
  shortcuts: [
    { label: "Entity", href: "glossary/inference/entity/" },
    { label: "Publication threshold", href: "specs/rules/publication-threshold/" },
    { label: "Keyword page", href: "glossary/publication/keyword-page/" },
    { label: "Source", href: "glossary/ingestion/source/" },
    { label: "Mentions panel", href: "specs/screens/mentions-panel/" },
  ],
  spaces: [
    corporateSpace("glossary", "GL", 48, "pages", "2026-09-11", "2 days ago"),
    corporateSpace("specs", "SP", 57, "pages", "2026-09-09", "4 days ago"),
    corporateSpace("meetings", "ME", 12, "documents", "2026-09-12", "yesterday"),
    corporateSpace("decisions", "DE", 8, "pages", "2026-09-01", "12 days ago"),
    corporateSpace("framing", "FR", 4, "pages", "2026-03-03", "6 months ago", true),
  ],
  moreSpaces: [
    corporateSpace("briefs", "BR", 3, "documents", "2026-08-20", "3 weeks ago"),
    corporateSpace("runbooks", "RU", 2, "pages", "2026-07-30", "last month"),
  ],
  recent: [
    {
      label: "Keyword page threshold review",
      href: "meetings/2026/keyword-page-threshold-review/",
      space: "meetings",
      date: "2026-09-12",
      dateLabel: "yesterday",
    },
    {
      label: "Entity",
      href: "glossary/inference/entity/",
      space: "glossary",
      date: "2026-09-11",
      dateLabel: "2 days ago",
    },
    {
      label: "Publication threshold",
      href: "specs/rules/publication-threshold/",
      space: "specs",
      date: "2026-09-09",
      dateLabel: "4 days ago",
    },
    {
      label: "Static site with islands",
      href: "decisions/publication/static-site-with-islands/",
      space: "decisions",
      date: "2026-09-01",
      dateLabel: "12 days ago",
    },
  ],
  alerts: [
    {
      title: "A space has not moved for 194 days",
      space: "framing",
      text: "framing. The alert threshold is set to 180 days in the configuration.",
    },
  ],
  labels: {
    question: "What are you looking for?",
    explanation:
      "Type a word of the business. If it is used anywhere in the documentation, it has a page \u2014 even if nobody has defined it yet.",
    mostCited: "Most cited",
    spaces: "Spaces",
    spacesLead: "fed by your repositories",
    moreSpaces: "2 more spaces, less cited",
    datesNote: "The dates come from the history of the repositories, so they are always right.",
    recent: "Recently changed",
  },
};
