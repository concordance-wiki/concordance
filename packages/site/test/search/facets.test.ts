import { describe, expect, it } from "vitest";

import {
  activeFiltersOf,
  countFacets,
  facetLabels,
  facetsOf,
  facetValue,
  filterEntries,
  matchesOthers,
} from "../../src/search/facets.js";
import type { SearchEntry, SearchMeta } from "../../src/search/shared.js";
import { emptyState, parseSearchState, searchQueryString } from "../../src/search/state.js";
import { searchLabels } from "../helpers/search.js";

const entries: SearchEntry[] = [
  {
    id: "glossary/keyword-page",
    title: "Keyword page",
    type: "term",
    url: "glossary/keyword-page/index.html",
    application: "concordance-cli",
    domain: "publication",
    status: "active",
    source: "glossary",
  },
  {
    id: "specs/screens/search-results",
    title: "Search results",
    type: "screen",
    url: "specs/screens/search-results/index.html",
    application: "concordance-cli",
    domain: "publication",
    status: "active",
    source: "specs",
  },
  {
    id: "specs/rules/publication-threshold",
    title: "Publication threshold",
    type: "rule",
    url: "specs/rules/publication-threshold/index.html",
    domain: "quality",
    status: "active",
    source: "specs",
  },
];

const meta: SearchMeta = {
  entities: entries,
  shards: [],
  types: { rule: "Rule", screen: "Screen", term: "Term" },
  applications: { "concordance-cli": "Command line" },
  domains: { publication: "Publication", quality: "Quality" },
  sources: { glossary: "glossary", specs: "specs" },
  counts: countFacets(entries, emptyState()),
  labels: searchLabels,
  locale: "en",
  bytes: 0,
};

describe("countFacets", () => {
  it("counts the entries carrying every value of every facet, values in code-unit order, an absent value counted nowhere", () => {
    expect(countFacets(entries, emptyState())).toEqual({
      type: { rule: 1, screen: 1, term: 1 },
      source: { glossary: 1, specs: 2 },
      domain: { publication: 2, quality: 1 },
      application: { "concordance-cli": 2 },
    });
  });

  it("counts every facet under the filters of the others, so that a second value of the same facet keeps a count", () => {
    expect(countFacets(entries, parseSearchState("?type=term&source=specs"))).toEqual({
      type: { rule: 1, screen: 1 },
      source: { glossary: 1 },
      domain: {},
      application: {},
    });
    expect(countFacets(entries, parseSearchState("?domain=quality"))).toEqual({
      type: { rule: 1 },
      source: { specs: 1 },
      domain: { publication: 2, quality: 1 },
      application: {},
    });
  });
});

describe("filterEntries and matchesOthers", () => {
  it("keeps the entries carrying one selected value of every facet, in the order given", () => {
    const ids = (search: string): string[] =>
      filterEntries(entries, (entry) => entry, parseSearchState(search)).map((entry) => entry.id);
    expect(ids("")).toEqual(entries.map((entry) => entry.id));
    expect(ids("?source=specs")).toEqual([
      "specs/screens/search-results",
      "specs/rules/publication-threshold",
    ]);
    expect(ids("?source=specs&type=screen,term")).toEqual(["specs/screens/search-results"]);
    expect(ids("?application=concordance-cli")).toEqual([
      "glossary/keyword-page",
      "specs/screens/search-results",
    ]);
    expect(ids("?application=none")).toEqual([]);
  });

  it("leaves one facet out when asked, and reads the value of an entry for a facet", () => {
    const state = parseSearchState("?type=term&source=specs");
    const [term, screen] = entries;
    expect(matchesOthers(term as SearchEntry, state)).toBe(false);
    expect(matchesOthers(term as SearchEntry, state, "source")).toBe(true);
    expect(matchesOthers(screen as SearchEntry, state, "type")).toBe(true);
    expect(facetValue(term as SearchEntry, "domain")).toBe("publication");
    expect(facetValue(entries[2] as SearchEntry, "application")).toBeUndefined();
  });
});

describe("facetsOf and activeFiltersOf", () => {
  it("lists every value the table knows, labelled, with its count, its state and the address of the toggled state", () => {
    const state = parseSearchState("?q=page&source=specs");
    const facets = facetsOf(meta, state, countFacets(entries, state), searchQueryString);
    expect(facets.map((facet) => [facet.name, facet.label])).toEqual([
      ["type", "Type"],
      ["source", "Source"],
      ["domain", "Domain"],
      ["application", "Application"],
    ]);
    expect(facets[0]?.values).toEqual([
      {
        value: "rule",
        label: "Rule",
        count: 1,
        href: "?q=page&type=rule&source=specs",
        active: false,
        disabled: false,
      },
      {
        value: "screen",
        label: "Screen",
        count: 1,
        href: "?q=page&type=screen&source=specs",
        active: false,
        disabled: false,
      },
      {
        value: "term",
        label: "Term",
        count: 0,
        href: "?q=page&type=term&source=specs",
        active: false,
        disabled: true,
      },
    ]);
    expect(facets[1]?.values).toEqual([
      {
        value: "glossary",
        label: "glossary",
        count: 1,
        href: "?q=page&source=glossary,specs",
        active: false,
        disabled: false,
      },
      { value: "specs", label: "specs", count: 2, href: "?q=page", active: true, disabled: false },
    ]);
    expect(facetLabels(meta, "domain")).toBe(meta.domains);
  });

  it("keeps a selected value enabled even at 0, so that it can be lifted", () => {
    const state = parseSearchState("?type=term&source=specs");
    const facets = facetsOf(meta, state, countFacets(entries, state), searchQueryString);
    expect(facets[0]?.values[2]).toEqual({
      value: "term",
      label: "Term",
      count: 0,
      href: "?source=specs",
      active: true,
      disabled: false,
    });
  });

  it("recalls the selected values in facet then value order, labelled, a value unknown to the table by itself", () => {
    expect(
      activeFiltersOf(
        meta,
        parseSearchState("?q=x&source=specs&type=term,unknown"),
        searchQueryString,
      ),
    ).toEqual([
      {
        name: "type",
        value: "term",
        facetLabel: "Type",
        label: "Term",
        href: "?q=x&type=unknown&source=specs",
      },
      {
        name: "type",
        value: "unknown",
        facetLabel: "Type",
        label: "unknown",
        href: "?q=x&type=term&source=specs",
      },
      {
        name: "source",
        value: "specs",
        facetLabel: "Source",
        label: "specs",
        href: "?q=x&type=term,unknown",
      },
    ]);
    expect(activeFiltersOf(meta, emptyState(), searchQueryString)).toEqual([]);
  });
});
