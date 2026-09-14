import type { JSX } from "preact";

import type {
  SpaceCategory,
  SpaceChange,
  SpaceLabels,
  SpaceProps,
  SpaceWord,
} from "../../slots.js";
import { Breadcrumb } from "./entity-page.js";
import { labels } from "./labels.js";

/** The labels of the default theme for every label the page does not receive; the counts are worded from the page. */
export function defaultSpaceLabels(pages: number, categories: number): SpaceLabels {
  return {
    breadcrumb: labels.breadcrumb,
    spaces: labels.spaces,
    pages: `${String(pages)} ${labels.pagesUnit}`,
    repository: labels.repository,
    browse: labels.browseHeading,
    categoriesLead: `${String(categories)} ${labels.categoriesLead}`,
    categoriesNote: labels.categoriesNote,
    recent: labels.recentlyChanged,
    mostCited: labels.mostCitedHere,
    wordsNote: labels.wordsNote,
    footer: labels.spaceFooter,
  };
}

/** A category: the name of the folder, one sentence when something declares one, its page count and the arrow to its list. */
function Category({ category }: { category: SpaceCategory }): JSX.Element {
  return (
    <li class="space-category">
      <a href={category.href}>
        <span class="space-category-name">{category.label}</span>
        <span class="space-category-text">{category.description ?? ""}</span>
        <span class="space-category-count">{category.count}</span>
        <span class="space-category-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </li>
  );
}

function Change({ change }: { change: SpaceChange }): JSX.Element {
  return (
    <li class="space-change">
      <a href={change.href}>
        <span class="space-change-title">{change.label}</span>
        <span class="space-change-meta">
          {change.category !== undefined && (
            <>
              {change.category}
              {" · "}
            </>
          )}
          <time dateTime={change.date}>{change.dateLabel ?? change.date}</time>
        </span>
      </a>
    </li>
  );
}

/** A word cited in the space: a chip with its count, dashed for a word without a note, which says so on hover and in hidden text so that the dashes never carry it alone. */
function Word({ word }: { word: SpaceWord }): JSX.Element {
  if (word.keyword !== true) {
    return (
      <li>
        <a class="chip" href={word.href}>
          {word.label}
          <span class="chip-count">{word.count}</span>
        </a>
      </li>
    );
  }
  const mark = word.title ?? labels.noNoteMark;
  return (
    <li>
      <a class="chip chip-keyword" href={word.href} title={mark}>
        {word.label}
        <span class="visually-hidden"> ({mark})</span>
        <span class="chip-count">{word.count}</span>
      </a>
    </li>
  );
}

/**
 * The page of a space, where a row of the home page leads: the breadcrumb from the spaces
 * page, the badge, the title, the sentence of the configuration and the line counting the
 * pages, naming the repository and dating the newest change; then two columns, the categories
 * of the repository on the left, each opening its own list, the pages changed last and the
 * words cited in the space on the right, closed by the sentence that a space is a small wiki
 * within the wiki. No tree here: it appears once per page, on the pages of the notes.
 */
export function Space({
  name,
  initials,
  description,
  spacesHref,
  repository,
  count,
  date,
  categories,
  recent,
  words,
  labels: given = {},
}: SpaceProps): JSX.Element {
  const text: SpaceLabels = { ...defaultSpaceLabels(count, categories.length), ...given };
  return (
    <div class="space-overview">
      <Breadcrumb
        items={[{ label: text.spaces, href: spacesHref }, { label: name }]}
        label={text.breadcrumb}
      />
      <header class="space-header">
        <span class="space-initials" aria-hidden="true">
          {initials}
        </span>
        <div class="space-heading">
          <h1>{name}</h1>
          {description !== undefined && <p class="space-description">{description}</p>}
          <p class="space-meta">
            <span>{text.pages}</span>
            <span>
              {text.repository} <code>{repository}</code>
            </span>
            {date !== undefined && <time dateTime={date}>{text.updated ?? date}</time>}
          </p>
        </div>
      </header>
      <div class="space-columns">
        <section class="space-browse" aria-labelledby="space-browse">
          <h2 id="space-browse">
            {text.browse} <span class="space-lead">{text.categoriesLead}</span>
          </h2>
          <ul class="space-categories">
            {categories.map((category) => (
              <Category key={category.href} category={category} />
            ))}
          </ul>
          <p class="space-note">{text.categoriesNote}</p>
        </section>
        <div class="space-side">
          <section class="space-recent" aria-labelledby="space-recent">
            <h2 id="space-recent">{text.recent}</h2>
            <ul class="space-changes">
              {recent.map((change) => (
                <Change key={change.href} change={change} />
              ))}
            </ul>
          </section>
          <section class="space-words" aria-labelledby="space-words">
            <h2 id="space-words">{text.mostCited}</h2>
            <ul class="space-word-list">
              {words.map((word) => (
                <Word key={word.href} word={word} />
              ))}
            </ul>
            <p class="space-note">{text.wordsNote}</p>
          </section>
          <p class="space-footer">{text.footer}</p>
        </div>
      </div>
    </div>
  );
}
