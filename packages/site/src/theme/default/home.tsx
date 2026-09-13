import type { JSX } from "preact";

import type { HomeAlert, HomeChange, HomeLabels, HomeProps, HomeSpace } from "../../slots.js";
import { labels } from "./labels.js";
import { SearchIsland } from "./search-island.js";

/** The labels of the default theme for every label the page does not receive; the folded spaces are counted from the page. */
export function defaultHomeLabels(folded: number): HomeLabels {
  return {
    question: labels.homeQuestion,
    explanation: labels.homeExplanation,
    mostCited: labels.mostCited,
    spaces: labels.spaces,
    spacesLead: labels.spacesLead,
    moreSpaces: `${String(folded)} ${labels.moreSpaces}`,
    datesNote: labels.datesNote,
    recent: labels.recentlyChanged,
  };
}

/** A change worded relative to the build when the page words it, the date otherwise. */
function When({ date, label }: { date: string; label: string | undefined }): JSX.Element {
  return <time dateTime={date}>{label ?? date}</time>;
}

/**
 * The row of a space: its initials badge, its name, its count and its freshness; the row leads
 * to the page of the space, never unfolds a tree.
 */
function Space({ space }: { space: HomeSpace }): JSX.Element {
  return (
    <li class={space.stale ? "home-space stale" : "home-space"}>
      <a class="home-space-row" href={space.href}>
        <span class="space-initials" aria-hidden="true">
          {space.initials}
        </span>
        <span class="home-space-text">
          <span class="home-space-name">{space.name}</span>
          <span class="home-space-meta">
            {space.countLabel ?? `${String(space.count)} ${space.unit}`}
            {space.date !== undefined && (
              <>
                {" · "}
                <When date={space.date} label={space.dateLabel} />
              </>
            )}
          </span>
        </span>
      </a>
    </li>
  );
}

function Change({ change }: { change: HomeChange }): JSX.Element {
  return (
    <li class="home-change">
      <a href={change.href}>
        <span class="home-change-title">{change.label}</span>
        <span class="home-change-meta">
          {change.space}
          {" · "}
          <When date={change.date} label={change.dateLabel} />
        </span>
      </a>
    </li>
  );
}

function Alert({ alert }: { alert: HomeAlert }): JSX.Element {
  return (
    <div class="home-alert">
      <h3>{alert.title}</h3>
      <p>{alert.text}</p>
    </div>
  );
}

/**
 * The home page: the question, the field with its live results in the flow of the page and
 * the most cited pages as shortcuts; then the spaces, each row leading to the page of its
 * source, the less cited ones folded behind a line counting them, and the pages changed last
 * with the alert on every dormant space. The letters of the index live on the index page and
 * the to-do link in the footer.
 */
export function Home({
  search,
  shortcuts,
  spaces,
  moreSpaces = [],
  recent,
  alerts,
  labels: given = {},
}: HomeProps): JSX.Element {
  const text: HomeLabels = { ...defaultHomeLabels(moreSpaces.length), ...given };
  return (
    <div class="home">
      <section class="home-ask" aria-labelledby="home-question">
        <h1 id="home-question">{text.question}</h1>
        <p class="home-explanation">{text.explanation}</p>
        {search && (
          <SearchIsland
            {...(search.root === undefined ? {} : { root: search.root })}
            search={search}
            home
          />
        )}
        {shortcuts.length > 0 && (
          <nav class="home-most-cited" aria-label={text.mostCited}>
            <span class="home-most-cited-lead">{text.mostCited}</span>
            <ul class="home-shortcuts">
              {shortcuts.map((link) => (
                <li key={link.href}>
                  <a class="chip" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>
      <div class="home-columns">
        <section class="home-spaces" aria-labelledby="home-tree">
          <h2 id="home-tree">
            {text.spaces} <span class="home-lead">{text.spacesLead}</span>
          </h2>
          <ul class="home-space-list">
            {spaces.map((space) => (
              <Space key={space.name} space={space} />
            ))}
          </ul>
          {moreSpaces.length > 0 && (
            <details class="home-more-spaces">
              <summary>{text.moreSpaces}</summary>
              <ul class="home-space-list">
                {moreSpaces.map((space) => (
                  <Space key={space.name} space={space} />
                ))}
              </ul>
            </details>
          )}
          <p class="home-note">{text.datesNote}</p>
        </section>
        <section class="home-recent" aria-labelledby="home-recent">
          <h2 id="home-recent">{text.recent}</h2>
          <ul class="home-change-list">
            {recent.map((change) => (
              <Change key={change.href} change={change} />
            ))}
          </ul>
          {alerts.map((alert) => (
            <Alert key={alert.space} alert={alert} />
          ))}
        </section>
      </div>
    </div>
  );
}
