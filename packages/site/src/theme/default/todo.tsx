import type { JSX } from "preact";

import type { TodoEntry, TodoProps } from "../../slots.js";
import { labels } from "./labels.js";

function TodoSection({
  id,
  title,
  entries,
}: {
  id: string;
  title: string;
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
        <ul>
          {entries.map((entry) => (
            <li key={entry.href}>
              <a href={entry.href}>{entry.label}</a> <span class="count">{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
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
        entries={documents}
      />
      <TodoSection id="todo-terms" title={labels.termsWithoutNote} entries={terms} />
    </div>
  );
}
