import type { JSX, TargetedEvent } from "preact";

import type { ActiveFilter, Facet, SearchResultsLabels, SearchResultsProps } from "../../slots.js";
import { labels as theme } from "./labels.js";
import { ResultList } from "./result-list.js";

type Navigate = ((href: string) => void) | undefined;

/** The click handler of a link the island follows in place; none in the served page, whose links reload. */
function follow(
  navigate: Navigate,
  href: string,
): ((event: TargetedEvent<HTMLAnchorElement>) => void) | undefined {
  if (navigate === undefined) return undefined;
  return (event) => {
    event.preventDefault();
    navigate(href);
  };
}

function FacetValues({ facet, navigate }: { facet: Facet; navigate: Navigate }): JSX.Element {
  return (
    <ul>
      {facet.values.map((value) => (
        <li key={value.value}>
          {value.disabled === true ? (
            <a class="facet-value" role="link" aria-disabled="true">
              {value.label ?? value.value} <span class="count">{value.count}</span>
            </a>
          ) : (
            <a
              href={value.href}
              onClick={follow(navigate, value.href)}
              {...(value.active === true ? { class: "facet-value", "aria-current": "true" } : {})}
            >
              {value.label ?? value.value} <span class="count">{value.count}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActiveFilters({
  active,
  clearHref,
  navigate,
  wording,
}: {
  active: ActiveFilter[];
  clearHref: string | undefined;
  navigate: Navigate;
  wording: SearchResultsLabels;
}): JSX.Element {
  return (
    <ul class="active-filters" aria-label={wording.activeFilters}>
      {active.map((filter) => (
        <li key={`${filter.name}=${filter.value}`} class="active-filter">
          <span class="facet-name">{filter.facetLabel}</span> {filter.label}{" "}
          <a href={filter.href} class="remove-filter" onClick={follow(navigate, filter.href)}>
            <span aria-hidden="true">×</span>
            <span class="visually-hidden">{wording.removeFilter}</span>
          </a>
        </li>
      ))}
      {clearHref !== undefined && (
        <li class="clear-filters">
          <a href={clearHref} onClick={follow(navigate, clearHref)}>
            {wording.clear}
          </a>
        </li>
      )}
    </ul>
  );
}

export function SearchResults(props: SearchResultsProps): JSX.Element {
  const { query, total, results, facets, active, summary, clearHref, onNavigate } = props;
  const wording: SearchResultsLabels = {
    facets: theme.facets,
    activeFilters: theme.activeFilters,
    removeFilter: theme.removeFilter,
    clear: theme.clearFilters,
    ...props.labels,
  };
  return (
    <div class="search-results">
      <h1>{theme.search}</h1>
      <p class="search-summary">
        {summary ?? (
          <>
            {total} {theme.resultsFor} <q>{query}</q>
          </>
        )}
      </p>
      {active !== undefined && active.length > 0 && (
        <ActiveFilters
          active={active}
          clearHref={clearHref}
          navigate={onNavigate}
          wording={wording}
        />
      )}
      {facets.length > 0 && (
        <nav class="facets" aria-label={wording.facets}>
          {facets.map((facet) => (
            <section key={facet.name} class="facet">
              <h2>{facet.label}</h2>
              <FacetValues facet={facet} navigate={onNavigate} />
            </section>
          ))}
        </nav>
      )}
      <ResultList results={results} />
    </div>
  );
}
