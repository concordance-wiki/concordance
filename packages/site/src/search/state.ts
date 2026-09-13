/**
 * The state of a search as the address of the results page carries it: `?q=…` for the query,
 * then one parameter per facet with its selected values separated by commas, `type=term,screen`.
 * Nothing here reaches Node either: the island parses and writes the addresses.
 */

import { byCodeUnit } from "../order.js";
import {
  FACET_NAMES,
  NOTELESS_FACET,
  NOTELESS_FILTERS,
  type FacetName,
  type NotelessFilter,
} from "./shared.js";

export interface SearchState {
  query: string;
  /** The selected values of every facet, in code-unit order; an empty list leaves the facet open. */
  filters: Record<FacetName, string[]>;
  /** What is done with the keyword pages; `any` keeps them among the results and is the default. */
  noteless: NotelessFilter;
}

/** The parameter of the query in the address. */
export const QUERY_PARAMETER = "q";

export function emptyState(): SearchState {
  return {
    query: "",
    filters: { type: [], source: [], domain: [], application: [] },
    noteless: "any",
  };
}

function isNotelessFilter(value: string): value is NotelessFilter {
  // Widened so that any string can be looked up; the guard narrows it back.
  return (NOTELESS_FILTERS as readonly string[]).includes(value);
}

/** The values of a facet parameter: split on commas, blanks dropped, once each, in code-unit order. */
function valuesOf(parameter: string | null): string[] {
  if (parameter === null) return [];
  return [...new Set(parameter.split(",").filter((value) => value !== ""))].sort(byCodeUnit);
}

/** The state an address carries; a parameter absent or empty leaves its part of the state empty. */
export function parseSearchState(search: string): SearchState {
  const parameters = new URLSearchParams(search);
  const state = emptyState();
  state.query = parameters.get(QUERY_PARAMETER) ?? "";
  for (const name of FACET_NAMES) {
    state.filters[name] = valuesOf(parameters.get(name));
  }
  const noteless = parameters.get(NOTELESS_FACET) ?? "any";
  if (isNotelessFilter(noteless)) state.noteless = noteless;
  return state;
}

/** A parameter value as the address shows it: readable, a space as `+`, a comma kept between the values of a facet. */
function encode(value: string): string {
  return encodeURIComponent(value).replaceAll("%20", "+").replaceAll("%2C", ",");
}

/** The query string of a state, `?q=…&type=…`, parameters in a fixed order; empty for the empty state. */
export function searchQueryString(state: SearchState): string {
  const parts: string[] = [];
  if (state.query !== "") parts.push(`${QUERY_PARAMETER}=${encode(state.query)}`);
  for (const name of FACET_NAMES) {
    const values = state.filters[name];
    if (values.length > 0) parts.push(`${name}=${values.map(encode).join(",")}`);
  }
  if (state.noteless !== "any") parts.push(`${NOTELESS_FACET}=${state.noteless}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

export function hasFilters(state: SearchState): boolean {
  return state.noteless !== "any" || FACET_NAMES.some((name) => state.filters[name].length > 0);
}

export function isSelected(state: SearchState, name: FacetName, value: string): boolean {
  return state.filters[name].includes(value);
}

/** The state with a facet value selected when it is not, lifted when it is; the rest untouched. */
export function toggleValue(state: SearchState, name: FacetName, value: string): SearchState {
  const values = isSelected(state, name, value)
    ? state.filters[name].filter((selected) => selected !== value)
    : [...state.filters[name], value].sort(byCodeUnit);
  return { ...state, filters: { ...state.filters, [name]: values } };
}

/** The state with the no-note facet on a value, or back to `any` when that value is the current one. */
export function toggleNoteless(state: SearchState, value: NotelessFilter): SearchState {
  return { ...state, noteless: state.noteless === value ? "any" : value };
}

/** The state with every facet open again, the query kept. */
export function clearFilters(state: SearchState): SearchState {
  return { ...emptyState(), query: state.query };
}

export function withQuery(state: SearchState, query: string): SearchState {
  return { ...state, query };
}
