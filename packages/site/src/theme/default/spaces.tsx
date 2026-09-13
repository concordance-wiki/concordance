import type { JSX } from "preact";

import type { SpaceRow, SpacesLabels, SpacesProps } from "../../slots.js";
import { labels } from "./labels.js";

/** The labels of the default theme for every label the page does not receive; the spaces are counted from the page. */
export function defaultSpacesLabels(count: number): SpacesLabels {
  return {
    title: labels.spaces,
    lead: `${String(count)} ${labels.spacesLeadAll}`,
    space: labels.spaceColumn,
    content: labels.contentColumn,
    pages: labels.pages,
    lastUpdate: labels.lastUpdate,
    datesNote: labels.spacesDatesNote,
  };
}

/**
 * The row of a space: the initials badge and the name linking to its page, what it holds, its
 * page count and its newest change; past the freshness threshold the date reads in the accent
 * and in days, the only place where a colour carries an alert.
 */
function Row({ space }: { space: SpaceRow }): JSX.Element {
  return (
    <tr class={space.stale ? "spaces-row stale" : "spaces-row"}>
      <th scope="row" class="spaces-name">
        <span class="space-initials" aria-hidden="true">
          {space.initials}
        </span>
        <a href={space.href}>{space.name}</a>
      </th>
      <td class="spaces-content">{space.content}</td>
      <td class="spaces-count">{space.count}</td>
      <td class="spaces-date">
        {space.date !== undefined && (
          <time dateTime={space.date}>{space.dateLabel ?? space.date}</time>
        )}
      </td>
    </tr>
  );
}

/**
 * The spaces page: the title, the sentence counting the spaces, one row per space in the
 * order of the home page, the most cited first, and the note on where the dates come from.
 * Every space is listed, none folded: this is the page that completes the first spaces of the
 * home page. A row leads to the page of the space, never unfolds a tree.
 */
export function Spaces({ spaces, labels: given = {} }: SpacesProps): JSX.Element {
  const text: SpacesLabels = { ...defaultSpacesLabels(spaces.length), ...given };
  return (
    <div class="spaces">
      <h1>{text.title}</h1>
      <p class="spaces-lead">{text.lead}</p>
      <table class="spaces-table">
        <thead>
          <tr>
            <th scope="col" class="spaces-name">
              {text.space}
            </th>
            <th scope="col" class="spaces-content">
              {text.content}
            </th>
            <th scope="col" class="spaces-count">
              {text.pages}
            </th>
            <th scope="col" class="spaces-date">
              {text.lastUpdate}
            </th>
          </tr>
        </thead>
        <tbody>
          {spaces.map((space) => (
            <Row key={space.name} space={space} />
          ))}
        </tbody>
      </table>
      <p class="spaces-note">{text.datesNote}</p>
    </div>
  );
}
