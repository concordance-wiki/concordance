import type { JSX, TargetedEvent } from "preact";

import { NOTELESS_FACET } from "../../search/shared.js";
import type {
  ActiveFilter,
  ClosestFormProposal,
  EmptyResults,
  Facet,
  FacetValue,
  SearchResultsLabels,
  SearchResultsProps,
} from "../../slots.js";
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

/** Lowercase ASCII slug of a facet value: accents removed, any other run of characters one `-`, none at either end. */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The values of a facet each with the id of its box, what its label points at: `facet-`, the
 * facet, then the slug of the value, which a configured name with a space or a quote would
 * otherwise leave invalid; a value slugging like an earlier one takes its rank. The slug is
 * computed here, not taken from the core package, which the island bundle cannot carry.
 */
function boxes(facet: Facet): { value: FacetValue; id: string }[] {
  const taken = new Set<string>();
  return facet.values.map((value) => {
    const base = `facet-${facet.name}-${slug(value.value)}`;
    let id = base;
    for (let rank = 2; taken.has(id); rank += 1) id = `${base}-${String(rank)}`;
    taken.add(id);
    return { value, id };
  });
}

/**
 * One value of a facet: a box the island follows when it changes, its label and its count. The
 * no-note facet keeps one value selected, so its boxes are radios; a value nothing would come
 * of stays listed at 0, disabled.
 */
function FacetBox({
  id,
  facet,
  value,
  navigate,
}: {
  id: string;
  facet: Facet;
  value: FacetValue;
  navigate: Navigate;
}): JSX.Element {
  const classes = ["facet-value"];
  if (value.active === true) classes.push("facet-active");
  if (value.disabled === true) classes.push("facet-disabled");
  if (value.keyword === true) classes.push("facet-keyword");
  return (
    <li class={classes.join(" ")}>
      <input
        type={facet.name === NOTELESS_FACET ? "radio" : "checkbox"}
        id={id}
        name={facet.name}
        value={value.value}
        checked={value.active === true}
        disabled={value.disabled === true}
        {...(navigate === undefined
          ? {}
          : {
              onChange: () => {
                navigate(value.href);
              },
            })}
      />
      <label for={id}>
        <span class="facet-label">{value.label ?? value.value}</span>
        <span class="count">{value.count}</span>
      </label>
    </li>
  );
}

/** A facet: a disclosure whose summary is its heading, open for the primary facets, folded for the others; a facet without a value is not drawn. */
function FacetGroup({ facet, navigate }: { facet: Facet; navigate: Navigate }): JSX.Element | null {
  if (facet.values.length === 0) return null;
  return (
    <details class="facet" open={facet.folded !== true}>
      <summary>
        <h2>{facet.label}</h2>
      </summary>
      <ul class="facet-values">
        {boxes(facet).map(({ value, id }) => (
          <FacetBox key={value.value} id={id} facet={facet} value={value} navigate={navigate} />
        ))}
      </ul>
    </details>
  );
}

/** The selected values as chips above the results, each a link lifting it, then the link clearing them all. */
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
          <a href={filter.href} class="remove-filter" onClick={follow(navigate, filter.href)}>
            <span class="visually-hidden">
              {wording.removeFilter} {filter.facetLabel}:{" "}
            </span>
            {filter.label} <span aria-hidden="true">✕</span>
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

/** The closest form of the dictionary, proposed when nothing matched: a link to the search on it, with its counts. */
function Closest({
  closest,
  navigate,
  wording,
}: {
  closest: ClosestFormProposal;
  navigate: Navigate;
  wording: SearchResultsLabels;
}): JSX.Element {
  return (
    <p class="search-closest">
      {wording.closestForm}{" "}
      <a href={closest.href} onClick={follow(navigate, closest.href)}>
        {closest.form}
      </a>
      , {closest.detail}
    </p>
  );
}

/**
 * The empty state of the results page as one card: the notice as its title, the sentence
 * naming the cause, the exits as rows each with its count, the closest form when there is
 * one, then the line on the prefix search when no file uses the word.
 */
function EmptyState({
  summary,
  empty,
  closest,
  navigate,
  wording,
}: {
  summary: string;
  empty: EmptyResults;
  closest: ClosestFormProposal | undefined;
  navigate: Navigate;
  wording: SearchResultsLabels;
}): JSX.Element {
  return (
    <div class="results-empty">
      <p class="results-empty-lead" role="status">
        {summary}
      </p>
      <p class="results-empty-cause">{empty.explanation}</p>
      {empty.exits.length > 0 && (
        <ul class="results-exits">
          {empty.exits.map((exit) => (
            <li key={exit.href}>
              <a
                class={
                  exit.secondary === true ? "results-exit results-exit-secondary" : "results-exit"
                }
                href={exit.href}
                onClick={follow(navigate, exit.href)}
              >
                <span class="results-exit-label">{exit.label}</span>
                {exit.count !== undefined && <span class="results-exit-count">{exit.count}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
      {closest !== undefined && <Closest closest={closest} navigate={navigate} wording={wording} />}
      {empty.note !== undefined && <p class="results-empty-note">{empty.note}</p>}
    </div>
  );
}

/**
 * The results page, its heading kept for assistive technology alone: the facets in the left
 * column, folded behind their heading where the page has no room for a column, the note on
 * their counters under them; on the right the active filters as chips with the summary, the
 * closest form when nothing matched, the list, the button drawing the next rows when the list
 * holds the first of more, and the note on the words without a note. The query and the filters
 * live in the address, which replays the search: nothing on the page repeats it.
 */
export function SearchResults(props: SearchResultsProps): JSX.Element {
  const { query, total, results, facets, active, summary, clearHref, closest, onNavigate } = props;
  const { empty } = props;
  const wording: SearchResultsLabels = {
    facets: theme.facets,
    activeFilters: theme.activeFilters,
    removeFilter: theme.removeFilter,
    clear: theme.clearFilters,
    countersNote: theme.resultsCountersNote,
    notelessNote: theme.resultsNotelessNote,
    closestForm: theme.closestForm,
    ...props.labels,
  };
  return (
    <div class="search-results">
      <h1 class="visually-hidden">{theme.search}</h1>
      <div class="results-layout">
        {facets.length > 0 && (
          <nav class="facets" aria-label={wording.facets}>
            <details class="facets-fold">
              <summary class="facets-head">{wording.facets}</summary>
              <div class="facet-groups">
                {facets.map((facet) => (
                  <FacetGroup key={facet.name} facet={facet} navigate={onNavigate} />
                ))}
                <p class="facets-note">{wording.countersNote}</p>
              </div>
            </details>
          </nav>
        )}
        <div class="results-main">
          <div class="results-head">
            {active !== undefined && active.length > 0 && (
              <ActiveFilters
                active={active}
                clearHref={clearHref}
                navigate={onNavigate}
                wording={wording}
              />
            )}
            {empty === undefined && (
              <p class="search-summary" role="status">
                {summary ?? (
                  <>
                    {total} {theme.resultsFor} <q>{query}</q>
                  </>
                )}
              </p>
            )}
          </div>
          {empty !== undefined && (
            <EmptyState
              summary={summary ?? theme.noResult}
              empty={empty}
              closest={closest}
              navigate={onNavigate}
              wording={wording}
            />
          )}
          {empty === undefined && closest !== undefined && (
            <Closest closest={closest} navigate={onNavigate} wording={wording} />
          )}
          {empty === undefined && <ResultList results={results} />}
          {props.more !== undefined && (
            <button type="button" class="results-more" onClick={props.more.onMore}>
              {props.more.label}
            </button>
          )}
          {results.length > 0 && <p class="results-note">{wording.notelessNote}</p>}
        </div>
      </div>
    </div>
  );
}
