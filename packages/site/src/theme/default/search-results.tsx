import type { JSX } from "preact";

import type { SearchResultsProps } from "../../slots.js";
import { labels } from "./labels.js";

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
      <ol class="results">
        {results.map((result) => (
          <li key={result.href} class="result">
            <a href={result.href}>{result.title}</a>
            {result.typeLabel !== undefined && <span class="badge">{result.typeLabel}</span>}
            {result.snippet !== undefined && <p class="snippet">{result.snippet}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
