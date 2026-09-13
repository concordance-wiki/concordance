import type { JSX } from "preact";

import type {
  IndexEntry,
  IndexFilters,
  IndexFilterValue,
  IndexLabels,
  IndexLetter,
  IndexProps,
} from "../../slots.js";
import { labels } from "./labels.js";

/** A count followed by its unit, the theme's own English: "1 word", "3 words". */
function counted(count: number, one: string, other: string): string {
  return `${String(count)} ${count === 1 ? one : other}`;
}

/**
 * The labels of the default theme for every label the page does not receive; the letters
 * without an entry are counted from the bar, the sentence under the title from the counts of
 * the page, and left out when the page gives none.
 */
export function defaultIndexLabels(
  counts: IndexProps["counts"],
  letters: readonly IndexLetter[],
): IndexLabels {
  const empty = letters.filter((letter) => letter.href === undefined).length;
  return {
    title: labels.indexTitle,
    lead:
      counts === undefined
        ? ""
        : `${counted(counts.words, labels.indexWord1, labels.indexWords)} ${labels.indexWordsUsed} ${String(counts.notes)} ${labels.indexHaveNote}`,
    filters: labels.indexFilters,
    byType: labels.indexByType,
    bySpace: labels.indexBySpace,
    letters: labels.letters,
    lettersWithout: counted(empty, labels.indexLetterWithout, labels.indexLettersWithout),
    word: labels.indexWord,
    type: labels.indexType,
    description: labels.indexDescription,
    pages: labels.indexPages,
    noDefinition: labels.indexNoDefinition,
    note: labels.indexNote,
  };
}

/** The icon of the filters button: three lines of decreasing length, decorative. */
function FilterGlyph(): JSX.Element {
  return (
    <svg
      class="index-filters-glyph"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

function FilterValues({ values }: { values: readonly IndexFilterValue[] }): JSX.Element {
  return (
    <ul class="index-filter-list">
      {values.map((value) => (
        <li key={value.href}>
          <a href={value.href}>
            {value.label}
            <span class="count">{value.count}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The filters, folded behind their button: by type, by space, and the words without a
 * definition; every value is a link to the results page filtered by it, so that the block works
 * without any script.
 */
function Filters({ filters, text }: { filters: IndexFilters; text: IndexLabels }): JSX.Element {
  return (
    <details class="index-filters">
      <summary class="index-filters-button">
        <FilterGlyph />
        {text.filters}
      </summary>
      <div class="index-filters-menu">
        <section class="index-filter">
          <h2>{text.byType}</h2>
          <FilterValues values={filters.types} />
        </section>
        <section class="index-filter">
          <h2>{text.bySpace}</h2>
          <FilterValues values={filters.spaces} />
        </section>
        <section class="index-filter">
          <FilterValues values={[filters.withoutDefinition]} />
        </section>
      </div>
    </details>
  );
}

/** The letter bar: a letter with entries links to its place, one without stays in view, struck through and inert. */
function Letters({
  letters,
  current,
  text,
}: {
  letters: readonly IndexLetter[];
  current: string | undefined;
  text: IndexLabels;
}): JSX.Element {
  return (
    <nav class="letters" aria-label={text.letters}>
      <ul>
        {letters.map((letter) => (
          <li key={letter.letter}>
            {letter.href === undefined ? (
              <span class="letter inactive" aria-disabled="true">
                {letter.letter}
              </span>
            ) : (
              <a
                class="letter"
                href={letter.href}
                aria-current={letter.letter === current ? "page" : undefined}
              >
                {letter.letter}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p class="letters-without">{text.lettersWithout}</p>
    </nav>
  );
}

/** One row: the word linking to its page, its type or the "no definition" mark, its first line or most cited passage, the pages citing it. */
function Row({ entry, text }: { entry: IndexEntry; text: IndexLabels }): JSX.Element {
  const noteless = entry.typeLabel === undefined;
  return (
    <tr class={noteless ? "index-entry index-entry-noteless" : "index-entry"}>
      <th scope="row" class="index-word">
        <a href={entry.href}>{entry.label}</a>
      </th>
      <td class="index-type">
        {noteless ? <span class="index-no-definition">{text.noDefinition}</span> : entry.typeLabel}
      </td>
      <td class="index-summary">{entry.summary}</td>
      <td class="index-pages">{entry.count}</td>
    </tr>
  );
}

interface LetterGroup {
  letter: string;
  /** The id of the group, the anchor of its first entry, which the letter bar leads to; absent on a page of one letter. */
  anchor?: string;
  entries: IndexEntry[];
}

/** The entries of one letter under its heading, "A — 94 words", then the table with its four columns. */
function Group({
  group,
  letters,
  text,
}: {
  group: LetterGroup;
  letters: readonly IndexLetter[];
  text: IndexLabels;
}): JSX.Element {
  const count = letters.find((letter) => letter.letter === group.letter)?.countLabel;
  return (
    <section class="index-letter" id={group.anchor}>
      <h2 class="index-letter-heading">
        <span class="index-letter-mark">{group.letter}</span>
        <span class="index-letter-count">
          {count ?? counted(group.entries.length, labels.indexWord1, labels.indexWords)}
        </span>
      </h2>
      <table class="index-table">
        <thead>
          <tr>
            <th scope="col" class="index-word">
              {text.word}
            </th>
            <th scope="col" class="index-type">
              {text.type}
            </th>
            <th scope="col" class="index-summary">
              {text.description}
            </th>
            <th scope="col" class="index-pages">
              {text.pages}
            </th>
          </tr>
        </thead>
        <tbody>
          {group.entries.map((entry) => (
            <Row key={entry.href} entry={entry} text={text} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * The groups of a page: the entries of the one letter it shows, or, for the whole index, one
 * group per letter, opened by the anchored first entry of the letter.
 */
export function groupsOf({ current, entries }: IndexProps): LetterGroup[] {
  if (current !== undefined) {
    return [{ letter: current, entries: [...entries] }];
  }
  const groups: LetterGroup[] = [];
  for (const entry of entries) {
    const open = groups[groups.length - 1];
    if (open !== undefined && entry.anchor === undefined) {
      open.entries.push(entry);
    } else {
      groups.push({
        letter: entry.letter,
        ...(entry.anchor === undefined ? {} : { anchor: entry.anchor }),
        entries: [entry],
      });
    }
  }
  return groups;
}

/**
 * The alphabetical index: the title and the sentence counting the words and the notes, the
 * filters folded behind their button, the letter bar with the count of the letters without an
 * entry, then the entries of every letter of the page under its heading, in a table of four
 * columns, the words without a definition dotted with the passage that uses them most in place
 * of a first line, and the note explaining them at the foot.
 */
export function Index(props: IndexProps): JSX.Element {
  const { letters, current, filters, labels: given = {} } = props;
  const text: IndexLabels = { ...defaultIndexLabels(props.counts, letters), ...given };
  return (
    <div class="index">
      <div class="index-head">
        <div class="index-title">
          <h1>{text.title}</h1>
          {text.lead !== "" && <p class="index-lead">{text.lead}</p>}
        </div>
        {filters !== undefined && <Filters filters={filters} text={text} />}
      </div>
      <Letters letters={letters} current={current} text={text} />
      {groupsOf(props).map((group) => (
        <Group key={group.letter} group={group} letters={letters} text={text} />
      ))}
      <p class="index-note">{text.note}</p>
    </div>
  );
}
