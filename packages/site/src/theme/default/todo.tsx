import type { JSX } from "preact";

import type { TodoEntry, TodoProps } from "../../slots.js";
import { labels } from "./labels.js";

function TodoSection({
  id,
  title,
  unit,
  entries,
}: {
  id: string;
  title: string;
  /** What the count of every entry counts. */
  unit: string;
  entries: TodoEntry[];
}): JSX.Element {
  return (
    <section class="todo-section" aria-labelledby={id}>
      <h2 id={id}>
        {title} <span class="count">{entries.length}</span>
      </h2>
      {entries.length === 0 ? (
        <p class="empty">{labels.nothingToDo}</p>
      ) : (
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
      )}
      <p class="todo-unit" id={`${id}-unit`}>
        {unit}
      </p>
    </section>
  );
}

export function Todo({ documents, terms }: TodoProps): JSX.Element {
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
      />
    </div>
  );
}
