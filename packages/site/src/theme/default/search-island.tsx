import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { SEARCH_ISLAND, SUGGESTIONS_CLASS, type SearchIslandProps } from "../../search/shared.js";
import type { SearchField } from "../../slots.js";
import { useSlot } from "../context.js";
import { labels } from "./labels.js";

/** The key that reaches the field from anywhere on the page, shown in it as a hint. */
export const SEARCH_SHORTCUT = "/";

/** The magnifier before the field and on the button that unfolds it, decorative: the label names the field, the text the button. */
export function SearchGlyph({ size = 15 }: { size?: number }): JSX.Element {
  return (
    <svg
      class="search-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M15.8 15.8 L21 21" />
    </svg>
  );
}

/**
 * The form of the header: a plain `GET` to the results page, so that it works before any
 * script runs; the field shows the shortcut that reaches it once the search island runs.
 */
export function SearchForm({ search }: { search: SearchField }): JSX.Element {
  return (
    <form
      class="site-search"
      role="search"
      aria-label={labels.siteSearch}
      action={search.action}
      method="get"
    >
      <label class="visually-hidden" for="site-search">
        {search.label ?? labels.search}
      </label>
      <span class="site-search-field">
        <SearchGlyph />
        <input
          id="site-search"
          type="search"
          name="q"
          placeholder={search.placeholder}
          autocomplete="off"
        />
        <kbd class="search-shortcut" aria-hidden="true">
          {SEARCH_SHORTCUT}
        </kbd>
      </span>
    </form>
  );
}

/**
 * The field at the head of the home page: the same `GET` form, drawn large, with the place
 * where the island counts the matches; its live results follow in the flow of the page.
 */
export function HomeSearchForm({ search }: { search: SearchField }): JSX.Element {
  const name = search.label ?? labels.search;
  return (
    <form class="home-search" role="search" aria-label={name} action={search.action} method="get">
      <label class="visually-hidden" for="home-search">
        {name}
      </label>
      <span class="home-search-field">
        <SearchGlyph size={20} />
        <input
          id="home-search"
          type="search"
          name="q"
          placeholder={search.placeholder}
          autocomplete="off"
        />
        <span class="search-count" aria-live="polite"></span>
      </span>
    </form>
  );
}

function SearchIslandBody({ search, home, results }: SearchIslandProps): JSX.Element {
  const Results = useSlot("SearchResults");
  return (
    <>
      {search &&
        (home === true ? <HomeSearchForm search={search} /> : <SearchForm search={search} />)}
      {search && (
        <div
          class={home === true ? `${SUGGESTIONS_CLASS} home-suggestions` : SUGGESTIONS_CLASS}
          hidden
        />
      )}
      {results && <Results {...results} />}
    </>
  );
}

/** The search island: the field of the header on every page and the one at the head of the home page, the results on the search page; one bundle wires them all. */
export const SearchIsland = island(SEARCH_ISLAND, SearchIslandBody);
