import type { JSX } from "preact";

import { markTitle } from "../../search/highlight.js";
import { plural, queryWords } from "../../search/shared.js";
import type { SuggestionLabels } from "../../slots.js";
import { labels } from "./labels.js";

/** The strings of the live results when the field carries none: the theme's own English. */
export const defaultSuggestionLabels: SuggestionLabels = {
  matches: { one: "# match", other: "# matches" },
  usedIn: { one: "Used in # document, never defined", other: "Used in # documents, never defined" },
  browse: labels.browse,
  enter: labels.enterKey,
  open: labels.open,
  seeResults: { one: "See the # result", other: "See the # results" },
};

/** One row of the live results: a page with its type, or a keyword page with the documents using it, and its space. */
export interface Suggestion {
  title: string;
  href: string;
  /** The type of the page, shown as a chip; absent for a keyword page. */
  typeLabel?: string;
  /** `true` for a keyword page, the page of a recurring expression nobody defined. */
  keyword?: boolean;
  /** How many documents use the expression of a keyword page. */
  documents?: number;
  /** The space the page belongs to. */
  space: string;
}

export interface SearchSuggestionsProps {
  query: string;
  /** The best matches, in rank order. */
  suggestions: Suggestion[];
  /** How many pages the query matches in all, the shown ones included. */
  total: number;
  /** The results page with the query, where the last line leads. */
  resultsHref: string;
  /** BCP 47 tag of the site, for the plural rules of the counts. */
  locale: string;
  labels?: Partial<SuggestionLabels>;
}

/** The title of a row, the start of every word the query matched marked. */
function Title({ title, words }: { title: string; words: readonly string[] }): JSX.Element {
  return (
    <span class="suggestion-title">
      {markTitle(title, words).map((piece, index) =>
        piece.marked ? <mark key={index}>{piece.text}</mark> : piece.text,
      )}
    </span>
  );
}

/**
 * The live results under a search field: one row per match with its title, its type or the
 * notice that nobody defined the expression, and its space; then the keyboard help and the
 * link to the whole list. Every row is a link, so that the arrow keys walk them and Enter
 * opens the one in focus.
 */
export function SearchSuggestions({
  query,
  suggestions,
  total,
  resultsHref,
  locale,
  labels: given = {},
}: SearchSuggestionsProps): JSX.Element {
  const text = { ...defaultSuggestionLabels, ...given };
  const words = queryWords(query);
  return (
    <>
      <ol class="suggestions">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.href}
            class={suggestion.keyword === true ? "suggestion suggestion-keyword" : "suggestion"}
          >
            <a href={suggestion.href}>
              <Title title={suggestion.title} words={words} />
              {suggestion.keyword === true ? (
                <span class="suggestion-detail">
                  {plural(text.usedIn, suggestion.documents ?? 0, locale)}
                </span>
              ) : (
                suggestion.typeLabel !== undefined && (
                  <span class="suggestion-detail">
                    <span class="badge">{suggestion.typeLabel}</span>
                  </span>
                )
              )}
              <span class="suggestion-space">{suggestion.space}</span>
            </a>
          </li>
        ))}
      </ol>
      <p class="suggestions-help">
        <kbd>↑ ↓</kbd> {text.browse} <kbd>{text.enter}</kbd> {text.open}
        <a class="suggestions-all" href={resultsHref}>
          {plural(text.seeResults, total, locale)}
        </a>
      </p>
    </>
  );
}
