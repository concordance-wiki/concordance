import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { SEARCH_ISLAND, SUGGESTIONS_CLASS, type SearchIslandProps } from "../../search/shared.js";
import type { SearchField } from "../../slots.js";
import { useSlot } from "../context.js";
import { labels } from "./labels.js";

/** The form of the header: a plain `GET` to the results page, so that it works before any script runs. */
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
      <input
        id="site-search"
        type="search"
        name="q"
        placeholder={search.placeholder}
        autocomplete="off"
      />
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
