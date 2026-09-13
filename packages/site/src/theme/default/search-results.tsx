import type { JSX, TargetedEvent } from "preact";

import { NOTELESS_FACET } from "../../search/shared.js";
import type {
  ActiveFilter,
  ClosestFormProposal,
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

/** The id of the box of a facet value, what its label points at. */
function boxId(facet: Facet, value: FacetValue): string {
  return `facet-${facet.name}-${value.value}`;
}

/**
 * One value of a facet: a box the island follows when it changes, its label and its count. The
 * no-note facet keeps one value selected, so its boxes are radios; a value nothing would come
 * of stays listed at 0, disabled.
 */
function FacetBox({
  facet,
  value,
  navigate,
}: {
  facet: Facet;
  value: FacetValue;
  navigate: Navigate;
}): JSX.Element {
  const id = boxId(facet, value);
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
        {facet.values.map((value) => (
          <FacetBox key={value.value} facet={facet} value={value} navigate={navigate} />
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

/** The address of the search, shown so that the state is explicit, with a copy button once the island runs on a page with a clipboard. */
function Address({
  address,
  copied,
  onCopy,
  wording,
}: {
  address: string;
  copied: boolean | undefined;
  onCopy: (() => void) | undefined;
  wording: SearchResultsLabels;
}): JSX.Element {
  return (
    <p class="search-address">
      <span class="visually-hidden">{wording.address}</span>
      <code class="search-url">{address}</code>
      {onCopy !== undefined && (
        <>
          <button type="button" class="copy-address" onClick={onCopy}>
            {wording.copyAddress}
          </button>
          <output class="copied">{copied === true ? wording.copied : ""}</output>
        </>
      )}
    </p>
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
 * The results page: the facets in the left column, folded behind their heading where the page
 * has no room for a column, the note on their counters under them; on the right the active
 * filters as chips with the summary, the address of the search, the closest form when nothing
 * matched, the list, and the note on the words without a note.
 */
export function SearchResults(props: SearchResultsProps): JSX.Element {
  const { query, total, results, facets, active, summary, clearHref, closest, onNavigate } = props;
  const wording: SearchResultsLabels = {
    facets: theme.facets,
    activeFilters: theme.activeFilters,
    removeFilter: theme.removeFilter,
    clear: theme.clearFilters,
    address: theme.searchAddress,
    copyAddress: theme.copyAddress,
    copied: theme.addressCopied,
    countersNote: theme.resultsCountersNote,
    notelessNote: theme.resultsNotelessNote,
    closestForm: theme.closestForm,
    ...props.labels,
  };
  return (
    <div class="search-results">
      <h1>{theme.search}</h1>
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
            <p class="search-summary" role="status">
              {summary ?? (
                <>
                  {total} {theme.resultsFor} <q>{query}</q>
                </>
              )}
            </p>
          </div>
          {props.address !== undefined && (
            <Address
              address={props.address}
              copied={props.copied}
              onCopy={props.onCopy}
              wording={wording}
            />
          )}
          {closest !== undefined && (
            <Closest closest={closest} navigate={onNavigate} wording={wording} />
          )}
          <ResultList results={results} />
          {results.length > 0 && <p class="results-note">{wording.notelessNote}</p>}
        </div>
      </div>
    </div>
  );
}
