import { describe, expect, it } from "vitest";

import {
  clearFilters,
  emptyState,
  hasFilters,
  isSelected,
  parseSearchState,
  QUERY_PARAMETER,
  searchQueryString,
  toggleValue,
  withQuery,
} from "../../src/search/state.js";

describe("The query and active filters are encoded in the URL parameters", () => {
  it("reads the query from q and the values of every facet from its parameter, comma-separated, once each, sorted", () => {
    expect(QUERY_PARAMETER).toBe("q");
    expect(
      parseSearchState(
        "?q=keyword+page&type=term,screen,term&source=specs&domain=&application=concordance-cli",
      ),
    ).toEqual({
      query: "keyword page",
      filters: {
        type: ["screen", "term"],
        source: ["specs"],
        domain: [],
        application: ["concordance-cli"],
      },
    });
    expect(parseSearchState("")).toEqual(emptyState());
    expect(parseSearchState("?")).toEqual(emptyState());
    expect(parseSearchState("?type=,,")).toEqual(emptyState());
    expect(parseSearchState("q=r%C3%A8gle&other=1")).toEqual({ ...emptyState(), query: "règle" });
  });

  it("writes the parameters in a fixed order, q then the facets, readable, and nothing for the empty state", () => {
    expect(searchQueryString(emptyState())).toBe("");
    expect(
      searchQueryString({
        query: "keyword page",
        filters: {
          type: ["screen", "term"],
          source: [],
          domain: ["inference/recognition"],
          application: ["concordance-cli"],
        },
      }),
    ).toBe(
      "?q=keyword+page&type=screen,term&domain=inference%2Frecognition&application=concordance-cli",
    );
    expect(searchQueryString({ ...emptyState(), query: "l'île & co, ltd" })).toBe(
      "?q=l'%C3%AEle+%26+co,+ltd",
    );
  });

  it("reads back what it writes", () => {
    const state = {
      query: "règle & seuil, cap",
      filters: { type: ["rule"], source: ["glossary", "specs"], domain: [], application: [] },
    };
    expect(parseSearchState(searchQueryString(state))).toEqual(state);
  });
});

describe("toggleValue, clearFilters and withQuery", () => {
  it("selects a value that is not, lifts one that is, keeping the values sorted and the rest untouched", () => {
    const state = parseSearchState("?q=key&type=term");
    const both = toggleValue(state, "type", "screen");
    expect(both.filters.type).toEqual(["screen", "term"]);
    expect(isSelected(both, "type", "screen")).toBe(true);
    expect(toggleValue(both, "type", "term").filters.type).toEqual(["screen"]);
    expect(toggleValue(state, "source", "specs")).toEqual({
      query: "key",
      filters: { type: ["term"], source: ["specs"], domain: [], application: [] },
    });
    expect(state.filters.type).toEqual(["term"]);
    expect(hasFilters(state)).toBe(true);
    expect(hasFilters(emptyState())).toBe(false);
  });

  it("clears every facet but keeps the query, and changes the query but keeps the facets", () => {
    const state = parseSearchState("?q=key&type=term&source=specs");
    expect(clearFilters(state)).toEqual({ ...emptyState(), query: "key" });
    expect(withQuery(state, "page")).toEqual({ ...state, query: "page" });
  });
});
