import type { JSX } from "preact";

import type { SearchResult } from "../../slots.js";

/** The classes of a row: the first one expanded as the lead, a word without a note outlined in dots. */
function rowClass(result: SearchResult, lead: boolean): string {
  const classes = ["result"];
  if (lead) classes.push("result-lead");
  if (result.keyword === true) classes.push("result-keyword");
  return classes.join(" ");
}

/**
 * The list of the results page. The first row is expanded: the type as a chip, the title, how
 * many pages cite it, the whole summary, then the line of facts; the following rows are
 * condensed on one line each: the chip, the title, the bare count of citing pages, the summary
 * cut to the row. A page nothing cites shows no count. A word without a note is outlined in
 * dots, its title dotted, and states in how many documents it is used.
 */
export function ResultList({ results }: { results: SearchResult[] }): JSX.Element {
  return (
    <ol class="results">
      {results.map((result, index) => {
        const lead = index === 0;
        return (
          <li key={result.href} class={rowClass(result, lead)}>
            <p class="result-head">
              {result.typeLabel !== undefined && <span class="badge">{result.typeLabel}</span>}
              <a class="result-title" href={result.href}>
                {result.title}
              </a>
              {lead
                ? result.cited !== undefined && <span class="result-cited">{result.cited}</span>
                : result.citedCount !== undefined &&
                  result.citedCount > 0 && (
                    <span class="result-cited result-cited-count">{result.citedCount}</span>
                  )}
            </p>
            {result.breadcrumb !== undefined && result.breadcrumb.length > 0 && (
              <span class="breadcrumb">{result.breadcrumb.join(" / ")}</span>
            )}
            {result.snippet !== undefined && <p class="snippet">{result.snippet}</p>}
            {lead && result.facts !== undefined && result.facts.length > 0 && (
              <p class="result-facts">
                {result.facts.map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </p>
            )}
            {result.subtitle !== undefined && (
              <span class="result-subtitle">{result.subtitle}</span>
            )}
            {result.detail !== undefined && <p class="result-detail">{result.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}
