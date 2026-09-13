import type { SlotProps } from "../../slots.js";

export const searchResults: SlotProps["SearchResults"] = {
  query: "threshold",
  total: 3,
  summary: "3 results, most cited first",
  address: "search/index.html?q=threshold&source=glossary",
  results: [
    {
      title: "Publication threshold",
      href: "../glossary/publication-threshold/",
      typeLabel: "term",
      cited: "cited in 12 pages",
      snippet: "Three occurrences in two files before a word gets a page.",
      facts: ["glossary", "Also called: threshold"],
    },
    {
      title: "Keyword page threshold review",
      href: "../meetings/threshold-review/",
      cited: "cited in 1 page",
      facts: ["specs"],
    },
    {
      title: "threshold review",
      href: "../keywords/threshold-review/",
      typeLabel: "Keyword",
      keyword: true,
      detail: "Used in 2 documents, never defined in the glossary",
    },
  ],
  active: [
    {
      name: "source",
      value: "glossary",
      facetLabel: "Space",
      label: "glossary",
      href: "?q=threshold",
    },
  ],
  clearHref: "?q=threshold",
  facets: [
    {
      name: "type",
      label: "Page type",
      values: [
        { value: "term", count: 1, href: "?q=threshold&type=term" },
        {
          value: "meeting",
          label: "Meeting",
          count: 1,
          href: "?q=threshold&type=meeting&source=glossary",
        },
        { value: "screen", label: "Screen", count: 0, href: "", disabled: true },
        {
          value: "keyword",
          label: "Keyword",
          count: 1,
          href: "?q=threshold&source=glossary&type=keyword",
          keyword: true,
        },
      ],
    },
    {
      name: "source",
      label: "Space",
      values: [
        { value: "glossary", count: 3, href: "?q=threshold", active: true },
        { value: "specs", count: 1, href: "?q=threshold&source=glossary,specs" },
      ],
    },
    {
      name: "nonote",
      label: "Without a note",
      folded: true,
      values: [
        {
          value: "any",
          label: "Included",
          count: 3,
          href: "?q=threshold&source=glossary",
          active: true,
        },
        {
          value: "only",
          label: "Only",
          count: 1,
          href: "?q=threshold&source=glossary&nonote=only",
        },
        {
          value: "exclude",
          label: "Excluded",
          count: 2,
          href: "?q=threshold&source=glossary&nonote=exclude",
        },
      ],
    },
  ],
};

/** A query that matched nothing: the empty state names it and proposes the closest form of the dictionary. */
export const searchResultsEmpty: SlotProps["SearchResults"] = {
  query: "thresold",
  total: 0,
  summary: "No result for \u201cthresold\u201d",
  address: "search/index.html?q=thresold",
  closest: {
    form: "threshold",
    href: "?q=threshold",
    detail: "cited in 12 pages",
  },
  results: [],
  facets: [],
};

/** The labels of the results page as the English catalogue writes them in the entity table. */
const searchResultsLabels = {
  facets: "Filters",
  activeFilters: "Active filters",
  removeFilter: "Remove this filter",
  clear: "Clear filters",
  address: "Address of this search",
  copyAddress: "Copy",
  copied: "Address copied",
  countersNote:
    "The counters are set when the site is published. Filtering happens in the browser, without a round trip.",
  notelessNote:
    "Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.",
  closestForm: "Closest form:",
};

/**
 * The results of "threshold" in the corporate chrome, the glossary space selected: two terms of
 * the fixtures corpus with their citations, summaries and declared names, a word without a note
 * dotted among them; the page type and the space open on the left, the other facets folded, the
 * application facet empty on a site whose sources declare none and therefore not drawn.
 */
export const searchResultsCorporate: SlotProps["SearchResults"] = {
  query: "threshold",
  total: 3,
  summary: "3 results, most cited first",
  address: "search/index.html?q=threshold&source=glossary",
  labels: searchResultsLabels,
  results: [
    {
      title: "Keyword page",
      href: "../glossary/keyword-page/",
      typeLabel: "Term",
      cited: "cited in 27 pages",
      snippet:
        "The page built for a candidate expression that crosses the publication threshold without any note defining it.",
      facts: ["glossary", "Also called: word page"],
    },
    {
      title: "Publication threshold",
      href: "../glossary/publication-threshold/",
      typeLabel: "Term",
      cited: "cited in 12 pages",
      snippet:
        "The minimum a candidate expression must reach to get a keyword page: three occurrences across two files by default.",
      facts: ["glossary", "Also called: threshold", "Broader term: Rule"],
    },
    {
      title: "threshold review",
      href: "../keywords/threshold-review/",
      typeLabel: "Keyword",
      keyword: true,
      detail: "Used in 2 documents, never defined in the glossary",
    },
  ],
  active: [
    {
      name: "source",
      value: "glossary",
      facetLabel: "Space",
      label: "glossary",
      href: "?q=threshold",
    },
  ],
  clearHref: "?q=threshold",
  facets: [
    {
      name: "type",
      label: "Page type",
      values: [
        { value: "term", label: "Term", count: 2, href: "?q=threshold&source=glossary&type=term" },
        { value: "rule", label: "Rule", count: 0, href: "", disabled: true },
        { value: "meeting", label: "Meeting", count: 0, href: "", disabled: true },
        {
          value: "keyword",
          label: "Keyword",
          count: 1,
          href: "?q=threshold&source=glossary&type=keyword",
          keyword: true,
        },
      ],
    },
    {
      name: "source",
      label: "Space",
      values: [
        { value: "glossary", count: 3, href: "?q=threshold", active: true },
        { value: "specs", count: 2, href: "?q=threshold&source=glossary,specs" },
      ],
    },
    {
      name: "domain",
      label: "Domain",
      folded: true,
      values: [
        {
          value: "publication",
          label: "Publication",
          count: 3,
          href: "?q=threshold&domain=publication&source=glossary",
        },
        { value: "quality", label: "Quality", count: 0, href: "", disabled: true },
      ],
    },
    { name: "application", label: "Application", folded: true, values: [] },
    {
      name: "nonote",
      label: "Without a note",
      folded: true,
      values: [
        {
          value: "any",
          label: "Included",
          count: 3,
          href: "?q=threshold&source=glossary",
          active: true,
        },
        {
          value: "only",
          label: "Only",
          count: 1,
          href: "?q=threshold&source=glossary&nonote=only",
        },
        {
          value: "exclude",
          label: "Excluded",
          count: 2,
          href: "?q=threshold&source=glossary&nonote=exclude",
        },
      ],
    },
  ],
};
