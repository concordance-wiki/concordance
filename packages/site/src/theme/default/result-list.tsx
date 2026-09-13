import type { JSX } from "preact";

import type { SearchResult } from "../../slots.js";

/**
 * The list of the results page. A row gives the type as a chip, the title, how many pages cite it, the summary, then the
 * line of facts; a word without a note is outlined in dots, its title dotted, and states in
 * how many documents it is used.
 */
export function ResultList({ results }: { results: SearchResult[] }): JSX.Element {
  return (
    <ol class="results">
      {results.map((result) => (
        <li key={result.href} class={result.keyword === true ? "result result-keyword" : "result"}>
          <p class="result-head">
            {result.typeLabel !== undefined && <span class="badge">{result.typeLabel}</span>}
            <a class="result-title" href={result.href}>
              {result.title}
            </a>
            {result.cited !== undefined && <span class="result-cited">{result.cited}</span>}
          </p>
          {result.breadcrumb !== undefined && result.breadcrumb.length > 0 && (
            <span class="breadcrumb">{result.breadcrumb.join(" / ")}</span>
          )}
          {result.snippet !== undefined && <p class="snippet">{result.snippet}</p>}
          {result.facts !== undefined && result.facts.length > 0 && (
            <p class="result-facts">
              {result.facts.map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </p>
          )}
          {result.subtitle !== undefined && <span class="result-subtitle">{result.subtitle}</span>}
          {result.detail !== undefined && <p class="result-detail">{result.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
