import type { JSX } from "preact";

import type { SearchResult } from "../../slots.js";

/** The list of results: the results page and the suggestions under the header field share it. */
export function ResultList({ results }: { results: SearchResult[] }): JSX.Element {
  return (
    <ol class="results">
      {results.map((result) => (
        <li key={result.href} class={result.keyword === true ? "result result-keyword" : "result"}>
          <a href={result.href}>{result.title}</a>
          {result.typeLabel !== undefined && <span class="badge">{result.typeLabel}</span>}
          {result.breadcrumb !== undefined && result.breadcrumb.length > 0 && (
            <span class="breadcrumb">{result.breadcrumb.join(" / ")}</span>
          )}
          {result.subtitle !== undefined && <span class="result-subtitle">{result.subtitle}</span>}
          {result.detail !== undefined && <span class="result-detail">{result.detail}</span>}
          {result.snippet !== undefined && <p class="snippet">{result.snippet}</p>}
        </li>
      ))}
    </ol>
  );
}
