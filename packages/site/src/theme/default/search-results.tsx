import type { JSX } from "preact";

import type { SearchResultsProps } from "../../slots.js";
import { labels } from "./labels.js";
import { ResultList } from "./result-list.js";

export function SearchResults({ query, total, results, facets }: SearchResultsProps): JSX.Element {
  return (
    <div class="search-results">
      <h1>{labels.search}</h1>
      <p class="search-summary">
        {total} {labels.resultsFor} <q>{query}</q>
      </p>
      {facets.length > 0 && (
        <nav class="facets" aria-label={labels.facets}>
          {facets.map((facet) => (
            <section key={facet.name} class="facet">
              <h2>{facet.label}</h2>
              <ul>
                {facet.values.map((value) => (
                  <li key={value.value}>
                    <a href={value.href}>
                      {value.value} <span class="count">{value.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}
      <ResultList results={results} />
    </div>
  );
}
