import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { SEARCH_ISLAND, SUGGESTIONS_CLASS, type SearchIslandProps } from "../../search/shared.js";
import type { SearchField } from "../../slots.js";
import { useSlot } from "../context.js";
import { labels } from "./labels.js";

/** The key that reaches the field from anywhere on the page, shown in it as a hint. */
export const SEARCH_SHORTCUT = "/";

/** The magnifier before the field, decorative: the label names the field. */
function SearchGlyph(): JSX.Element {
  return (
    <svg
      class="search-glyph"
      width="15"
      height="15"
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

function SearchIslandBody({ search, results }: SearchIslandProps): JSX.Element {
  const Results = useSlot("SearchResults");
  return (
    <>
      {search && <SearchForm search={search} />}
      {search && <div class={SUGGESTIONS_CLASS} hidden />}
      {results && <Results {...results} />}
    </>
  );
}

/** The search island: the header field on every page, the results on the search page; one bundle wires both. */
export const SearchIsland = island(SEARCH_ISLAND, SearchIslandBody);
