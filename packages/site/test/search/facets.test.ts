import { describe, expect, it } from "vitest";

import {
  activeFiltersOf,
  countFacets,
  facetLabels,
  facetsOf,
  facetValue,
  filterEntries,
  matchesOthers,
  notelessCount,
  notelessFacetOf,
  PRIMARY_FACETS,
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
  glossary: [],
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
      nonote: { only: 0, exclude: 3 },
    });
  });

  it("counts every facet under the filters of the others, so that a second value of the same facet keeps a count", () => {
    expect(countFacets(entries, parseSearchState("?type=term&source=specs"))).toEqual({
      type: { rule: 1, screen: 1 },
      source: { glossary: 1 },
      domain: {},
      application: {},
      nonote: { only: 0, exclude: 0 },
    });
    expect(countFacets(entries, parseSearchState("?domain=quality"))).toEqual({
      type: { rule: 1 },
      source: { specs: 1 },
      domain: { publication: 2, quality: 1 },
      application: {},
      nonote: { only: 0, exclude: 1 },
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
    expect(facets.map((facet) => [facet.name, facet.label, facet.folded])).toEqual([
      ["type", "Page type", undefined],
      ["source", "Space", undefined],
      ["domain", "Domain", true],
      ["application", "Application", true],
      ["nonote", "Without a note", true],
    ]);
    expect(PRIMARY_FACETS).toEqual(["type", "source"]);
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

  it("flags the keyword type among the page types and lists it last, so that the page draws it dotted under the others", () => {
    const table: SearchMeta = {
      ...meta,
      types: { keyword: "Without a definition", ...meta.types },
    };
    const facets = facetsOf(table, emptyState(), meta.counts, searchQueryString);
    expect(facets[0]?.values.map((value) => [value.value, value.keyword])).toEqual([
      ["rule", undefined],
      ["screen", undefined],
      ["term", undefined],
      ["keyword", true],
    ]);
    expect(facets[0]?.values[3]?.label).toBe("Without a definition");
    expect(facets[1]?.values.map((value) => value.keyword)).toEqual([undefined, undefined]);
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
        facetLabel: "Page type",
        label: "Term",
        href: "?q=x&type=unknown&source=specs",
      },
      {
        name: "type",
        value: "unknown",
        facetLabel: "Page type",
        label: "unknown",
        href: "?q=x&type=term&source=specs",
      },
      {
        name: "source",
        value: "specs",
        facetLabel: "Space",
        label: "specs",
        href: "?q=x&type=term,unknown",
      },
    ]);
    expect(activeFiltersOf(meta, emptyState(), searchQueryString)).toEqual([]);
  });
});

describe("The no-note facet over the entries", () => {
  const summary: SearchEntry = {
    id: "keywords/build-summary",
    title: "build summary",
    type: "keyword",
    url: "keywords/build-summary/index.html",
    status: "valid",
    source: "specs",
    keyword: true,
    occurrences: 5,
    documents: 3,
  };
  const all = [...entries, summary];

  it("keeps every entry under any, the keyword pages alone under only, the others under exclude, the field facets still applying", () => {
    const ids = (search: string): string[] =>
      filterEntries(all, (entry) => entry, parseSearchState(search)).map((entry) => entry.id);
    expect(ids("")).toHaveLength(4);
    expect(ids("?nonote=only")).toEqual(["keywords/build-summary"]);
    expect(ids("?nonote=exclude")).toEqual(entries.map((entry) => entry.id));
    expect(ids("?nonote=only&source=glossary")).toEqual([]);
    expect(ids("?nonote=exclude&source=specs")).toEqual([
      "specs/screens/search-results",
      "specs/rules/publication-threshold",
    ]);
    expect(matchesOthers(summary, parseSearchState("?nonote=exclude"), "nonote")).toBe(true);
    expect(matchesOthers(summary, parseSearchState("?nonote=exclude"), "type")).toBe(false);
  });

  it("counts the keyword pages and the others under the field facets, and draws the three values with one always active", () => {
    const state = parseSearchState("?source=specs");
    const counts = countFacets(all, state);
    expect(counts.nonote).toEqual({ only: 1, exclude: 2 });
    expect(notelessCount(counts, "any")).toBe(3);
    expect(notelessCount(counts, "only")).toBe(1);
    expect(notelessCount(counts, "exclude")).toBe(2);
    expect(notelessFacetOf(meta, state, counts, searchQueryString)).toEqual({
      name: "nonote",
      label: "Without a note",
      folded: true,
      values: [
        {
          value: "any",
          label: "Included",
          count: 3,
          href: "?source=specs",
          active: true,
          disabled: false,
        },
        {
          value: "only",
          label: "Only",
          count: 1,
          href: "?source=specs&nonote=only",
          active: false,
          disabled: false,
        },
        {
          value: "exclude",
          label: "Excluded",
          count: 2,
          href: "?source=specs&nonote=exclude",
          active: false,
          disabled: false,
        },
      ],
    });
    const only = parseSearchState("?source=glossary&nonote=only");
    const none = countFacets(all, only);
    expect(none.nonote).toEqual({ only: 0, exclude: 1 });
    expect(none.type).toEqual({});
    expect(notelessFacetOf(meta, only, none, searchQueryString).values).toEqual([
      {
        value: "any",
        label: "Included",
        count: 1,
        href: "?source=glossary",
        active: false,
        disabled: false,
      },
      {
        value: "only",
        label: "Only",
        count: 0,
        href: "?source=glossary",
        active: true,
        disabled: false,
      },
      {
        value: "exclude",
        label: "Excluded",
        count: 1,
        href: "?source=glossary&nonote=exclude",
        active: false,
        disabled: false,
      },
    ]);
    expect(facetsOf(meta, only, none, searchQueryString)[4]?.name).toBe("nonote");
  });

  it("recalls the choice after the field facets, with the address that lifts it", () => {
    expect(
      activeFiltersOf(meta, parseSearchState("?type=term&nonote=exclude"), searchQueryString),
    ).toEqual([
      {
        name: "type",
        value: "term",
        facetLabel: "Page type",
        label: "Term",
        href: "?nonote=exclude",
      },
      {
        name: "nonote",
        value: "exclude",
        facetLabel: "Without a note",
        label: "Excluded",
        href: "?type=term",
      },
    ]);
  });
});
