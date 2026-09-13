import type { JSX } from "preact";

import { markTitle } from "../../search/highlight.js";
import { plural, queryWords } from "../../search/shared.js";
import type { SuggestionLabels } from "../../slots.js";
import { labels } from "./labels.js";

/** The strings of the live results when the field carries none: the theme's own English. */
export const defaultSuggestionLabels: SuggestionLabels = {
  matches: { one: "# match", other: "# matches" },
  usedIn: { one: "Used in # document, never defined", other: "Used in # documents, never defined" },
  typeSummary: "{type} — {summary}",
  glossaryTerm: {
    one: "Glossary term — cited in # page",
    other: "Glossary term — cited in # pages",
  },
  browse: labels.browse,
  enter: labels.enterKey,
  open: labels.open,
  seeResults: { one: "See the # result", other: "See the # results" },
};

/** One row of the live results: a page with its type and its first line, a glossary term with its citations, or a keyword page with the documents using it, and its space. */
export interface Suggestion {
  title: string;
  href: string;
  /** What tells the row apart from another of the same title, after the title: its space, or its folder when the spaces agree. */
  qualifier?: string;
  /** The type of the page; absent for a keyword page. */
  typeLabel?: string;
  /** The first line of a note, its summary, what the detail line quotes after the type. */
  summary?: string;
  /** `true` for a note of a glossary source: its detail line counts the pages citing it rather than quoting its definition. */
  glossary?: boolean;
  /** How many pages cite a note. */
  cited?: number;
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

/** The title of a row, the start of every word the query matched marked, then what tells it apart from a namesake. */
function Title({
  suggestion,
  words,
}: {
  suggestion: Suggestion;
  words: readonly string[];
}): JSX.Element {
  return (
    <span class="suggestion-title">
      {markTitle(suggestion.title, words).map((piece, index) =>
        piece.marked ? <mark key={index}>{piece.text}</mark> : piece.text,
      )}
      {suggestion.qualifier !== undefined && (
        <span class="suggestion-qualifier"> · {suggestion.qualifier}</span>
      )}
    </span>
  );
}

/**
 * The detail line of a row: the documents of a keyword page, the citations of a glossary term,
 * the type and the first line of any other note, either alone when the note lacks the other;
 * none for an untyped note without a first line.
 */
export function suggestionDetail(
  suggestion: Suggestion,
  text: SuggestionLabels,
  locale: string,
): string | undefined {
  if (suggestion.keyword === true) {
    return plural(text.usedIn, suggestion.documents ?? 0, locale);
  }
  if (suggestion.glossary === true) {
    return plural(text.glossaryTerm, suggestion.cited ?? 0, locale);
  }
  const { typeLabel, summary } = suggestion;
  if (typeLabel !== undefined && summary !== undefined) {
    return text.typeSummary.replace("{type}", typeLabel).replace("{summary}", summary);
  }
  return typeLabel ?? summary;
}

/**
 * The live results under a search field: one row per match with its title, its detail line and
 * its space; then the keyboard help and the link to the whole list. Every row is a link, so
 * that the arrow keys walk them and Enter opens the one in focus; the first row, the one Enter
 * from the field would open, stands on the soft colour.
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
        {suggestions.map((suggestion) => {
          const detail = suggestionDetail(suggestion, text, locale);
          return (
            <li
              key={suggestion.href}
              class={suggestion.keyword === true ? "suggestion suggestion-keyword" : "suggestion"}
            >
              <a href={suggestion.href}>
                <Title suggestion={suggestion} words={words} />
                {detail !== undefined && <span class="suggestion-detail">{detail}</span>}
                <span class="suggestion-space">{suggestion.space}</span>
              </a>
            </li>
          );
        })}
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
