import type { SearchLabels } from "../../src/search/shared.js";

/** The strings of the results page as the English catalogue writes them in the entity table. */
export const searchLabels: SearchLabels = {
  facets: "Filters",
  facet: { type: "Type", source: "Source", domain: "Domain", application: "Application" },
  activeFilters: "Active filters",
  removeFilter: "Remove this filter",
  clear: "Clear filters",
  noResult: "No result",
  results: { one: "# result", other: "# results" },
  address: "Address of this search",
  copyAddress: "Copy",
  copied: "Address copied",
  noteless: { label: "Without a note", any: "Included", only: "Only", exclude: "Excluded" },
  undefinedExpression: "Expression without a note",
  occurrences: { one: "# occurrence", other: "# occurrences" },
  documents: { one: "# document", other: "# documents" },
};
