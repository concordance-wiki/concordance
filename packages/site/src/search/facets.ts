/**
 * The facets of the results page: which entries the selected values keep, how many entries carry
 * every value, and the view model the results component draws. Pure, so that the build computes
 * the counts of the whole table with the same code the island runs over the results of a query.
 */

import { byCodeUnit } from "../order.js";
import type { ActiveFilter, Facet } from "../slots.js";
import {
  FACET_NAMES,
  type FacetCounts,
  type FacetName,
  type SearchEntry,
  type SearchMeta,
} from "./shared.js";
import { isSelected, toggleValue, type SearchState } from "./state.js";

/** The value of an entry for a facet; none for an entity filed under no application or domain. */
export function facetValue(entry: SearchEntry, name: FacetName): string | undefined {
  return entry[name];
}

/** Whether an entry passes the selected values of one facet: any of them, or all of them when none is selected. */
function passes(entry: SearchEntry, state: SearchState, name: FacetName): boolean {
  const values = state.filters[name];
  if (values.length === 0) return true;
  const value = facetValue(entry, name);
  return value !== undefined && values.includes(value);
}

/**
 * Whether an entry passes every facet but the one named, the facets combining by intersection.
 * Leaving one out is what gives its values a count worth showing: what selecting each of them
 * would keep, so that a second value of the same facet stays selectable.
 */
export function matchesOthers(entry: SearchEntry, state: SearchState, except?: FacetName): boolean {
  return FACET_NAMES.every((name) => name === except || passes(entry, state, name));
}

/** The entries every selected value keeps, in the order given. */
export function filterEntries<T>(
  items: readonly T[],
  entryOf: (item: T) => SearchEntry,
  state: SearchState,
): T[] {
  return items.filter((item) => matchesOthers(entryOf(item), state));
}

/** The number of entries carrying every value of every facet, each facet counted under the filters of the others; values in code-unit order. */
export function countFacets(entries: readonly SearchEntry[], state: SearchState): FacetCounts {
  const counts: FacetCounts = { type: {}, source: {}, domain: {}, application: {} };
  for (const name of FACET_NAMES) {
    const table = counts[name];
    for (const entry of entries) {
      const value = facetValue(entry, name);
      if (value === undefined || !matchesOthers(entry, state, name)) continue;
      table[value] = (table[value] ?? 0) + 1;
    }
    counts[name] = Object.fromEntries(Object.entries(table).sort(([a], [b]) => byCodeUnit(a, b)));
  }
  return counts;
}

/** The label table of a facet in the entity table: what every value is called. */
export function facetLabels(meta: SearchMeta, name: FacetName): Record<string, string> {
  const tables: Record<FacetName, Record<string, string>> = {
    type: meta.types,
    source: meta.sources,
    domain: meta.domains,
    application: meta.applications,
  };
  return tables[name];
}

/**
 * The facets as the results page draws them: every value the site knows, in the order of the
 * table, with its count under the current filters, selected or not, and disabled when nothing
 * would come of selecting it; `hrefOf` gives the address of the state a click leads to.
 */
export function facetsOf(
  meta: SearchMeta,
  state: SearchState,
  counts: FacetCounts,
  hrefOf: (state: SearchState) => string,
): Facet[] {
  return FACET_NAMES.map((name) => {
    const labels = facetLabels(meta, name);
    return {
      name,
      label: meta.labels.facet[name],
      values: Object.entries(labels).map(([value, label]) => {
        const count = counts[name][value] ?? 0;
        const active = isSelected(state, name, value);
        return {
          value,
          label,
          count,
          href: hrefOf(toggleValue(state, name, value)),
          active,
          disabled: count === 0 && !active,
        };
      }),
    };
  });
}

/** The selected values recalled above the results, in facet then value order, each with the address that lifts it. */
export function activeFiltersOf(
  meta: SearchMeta,
  state: SearchState,
  hrefOf: (state: SearchState) => string,
): ActiveFilter[] {
  return FACET_NAMES.flatMap((name) =>
    state.filters[name].map((value) => ({
      name,
      value,
      facetLabel: meta.labels.facet[name],
      label: facetLabels(meta, name)[value] ?? value,
      href: hrefOf(toggleValue(state, name, value)),
    })),
  );
}
