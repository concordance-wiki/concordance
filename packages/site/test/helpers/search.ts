import type { SearchLabels } from "../../src/search/shared.js";

/** The strings of the results page as the English catalogue writes them in the entity table. */
export const searchLabels: SearchLabels = {
  facets: "Filters",
  facet: { type: "Page type", source: "Space", domain: "Domain", application: "Application" },
  activeFilters: "Active filters",
  removeFilter: "Remove this filter",
  clear: "Clear filters",
  noResult: "No result",
  noResultFor: "No result for “{query}”",
  results: { one: "# result, most cited first", other: "# results, most cited first" },
  countersNote:
    "The counters are set when the site is published. Filtering happens in the browser, without a round trip.",
  noteless: { label: "Without a note", any: "Included", only: "Only", exclude: "Excluded" },
  cited: { one: "cited in # page", other: "cited in # pages" },
  alsoCalled: "Also called: {aliases}",
  broader: "Broader term: {term}",
  usedIn: {
    one: "Used in # document, never defined in the glossary",
    other: "Used in # documents, never defined in the glossary",
  },
  notelessNote:
    "Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.",
  closestForm: "Closest form:",
  occurrences: { one: "# occurrence", other: "# occurrences" },
  showNext: { one: "Show the next one", other: "Show the next #" },
};
