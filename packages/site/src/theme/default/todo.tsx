import type { JSX } from "preact";

import type { TodoEntry, TodoLabels, TodoNoiseEntry, TodoProps } from "../../slots.js";
import { labels } from "./labels.js";
import { fill } from "./mention-list.js";

/** How many words the page lists before the fold; the others unfold on demand, without a script. */
export const TODO_VISIBLE_TERMS = 100;

// Kept here rather than in the shared labels, which the islands bundle under a weight limit: no island renders this page.
const noiseLabels = {
  noise: "Suspected noise",
  noiseNote:
    "Frequent enough for a page, but spread like the prose of the notes rather than a term of the corpus: no page, no mark in the text, still found by the search.",
  contribute: "Add them to the project's stopwords",
};

/** The labels of the default theme, used for every label the page does not receive; the fold count is worded from the page. */
export function defaultTodoLabels(others: number): TodoLabels {
  return { showOthers: fill(labels.showOthers, { count: others }), ...noiseLabels };
}

function EntryList({ id, entries }: { id: string; entries: TodoEntry[] }): JSX.Element {
  return (
    <ul aria-describedby={`${id}-unit`}>
      {entries.map((entry) => (
        <li key={entry.href}>
          <a href={entry.href}>{entry.label}</a> <span class="count">{entry.count}</span>
          {entry.files !== undefined && (
            <span class="todo-files">
              {entry.files} {labels.files}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function TodoSection({
  id,
  title,
  unit,
  entries,
  showOthers,
}: {
  id: string;
  title: string;
  /** What the count of every entry counts. */
  unit: string;
  entries: TodoEntry[];
  /** The line that unfolds the entries after the first hundred; the section folds nothing without it. */
  showOthers?: string;
}): JSX.Element {
  const visible = showOthers === undefined ? entries : entries.slice(0, TODO_VISIBLE_TERMS);
  const folded = entries.slice(visible.length);
  return (
    <section class="todo-section" aria-labelledby={id}>
      <h2 id={id}>
        {title} <span class="count">{entries.length}</span>
      </h2>
      {entries.length === 0 ? (
        <p class="empty">{labels.nothingToDo}</p>
      ) : (
        <EntryList id={id} entries={visible} />
      )}
      {folded.length > 0 && (
        <details class="todo-fold">
          <summary>{showOthers}</summary>
          <EntryList id={id} entries={folded} />
        </details>
      )}
      <p class="todo-unit" id={`${id}-unit`}>
        {unit}
      </p>
    </section>
  );
}

/** The expressions the confidence set aside, folded: each with its counts and its reason, none linked, none paged. */
function NoiseSection({
  entries,
  contributeHref,
  text,
}: {
  entries: TodoNoiseEntry[];
  contributeHref?: string;
  text: TodoLabels;
}): JSX.Element {
  return (
    <section class="todo-section todo-noise" aria-labelledby="todo-noise">
      <details class="todo-fold">
        <summary>
          <h2 id="todo-noise">
            {text.noise} <span class="count">{entries.length}</span>
          </h2>
        </summary>
        <p class="todo-unit">{text.noiseNote}</p>
        {entries.length === 0 ? (
          <p class="empty">{labels.nothingToDo}</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.label}>
                <span class="todo-word">{entry.label}</span>{" "}
                <span class="count">{entry.count}</span>
                <span class="todo-files">
                  {entry.files} {labels.files}
                </span>
                <span class="todo-reason">{entry.reason}</span>
              </li>
            ))}
          </ul>
        )}
        {contributeHref !== undefined && entries.length > 0 && (
          <p class="todo-contribute">
            <a href={contributeHref}>{text.contribute}</a>
          </p>
        )}
      </details>
    </section>
  );
}

export function Todo({
  documents,
  terms,
  noise = [],
  contributeHref,
  labels: given = {},
}: TodoProps): JSX.Element {
  const others = Math.max(0, terms.length - TODO_VISIBLE_TERMS);
  const text: TodoLabels = { ...defaultTodoLabels(others), ...given };
  return (
    <div class="todo">
      <h1>{labels.todo}</h1>
      <TodoSection
        id="todo-documents"
        title={labels.documentsWithoutMarkdown}
        unit={labels.filesWithoutMarkdown}
        entries={documents}
      />
      <TodoSection
        id="todo-terms"
        title={labels.termsWithoutNote}
        unit={labels.occurrencesUnit}
        entries={terms}
        showOthers={text.showOthers}
      />
      <NoiseSection
        entries={noise}
        {...(contributeHref === undefined ? {} : { contributeHref })}
        text={text}
      />
    </div>
  );
}
