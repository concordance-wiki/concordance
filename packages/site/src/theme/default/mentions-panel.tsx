import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { Mention, MentionsPanelProps, RelatedLabels } from "../../slots.js";
import { labels } from "./labels.js";
import { groupByPage } from "./mention-list.js";
import {
  MENTIONS_EMBEDDED,
  MENTIONS_EMBEDDED_MAX,
  MENTIONS_ISLAND,
  MentionsIsland,
} from "./mentions-island.js";

// Created here rather than next to the component, so that the hydration entry bundles no server-side helper.
const MentionsBody = island(MENTIONS_ISLAND, MentionsIsland);

/** JSON safe inside a script element: no `<` can close it early. */
export function embedMentions(mentions: readonly Mention[]): string {
  return JSON.stringify(mentions).replaceAll("<", "\\u003c");
}

/** The labels of the default theme, used when the panel receives none. */
export const defaultRelatedLabels: RelatedLabels = {
  related: labels.relatedPages,
  filterPages: labels.filterPages,
  types: labels.types,
  pagesOf: labels.pagesOf,
  clearAll: labels.clearAll,
  cited: labels.cited,
  passage: labels.passage,
  passages: labels.passagesOf,
  showOthers: labels.showOthers,
  other: labels.other,
  others: labels.others,
  loadingOthers: labels.loadingOthers,
  othersUnavailable: labels.othersUnavailable,
  fullList: labels.fullList,
  orderNote: labels.orderNote,
  noRelated: labels.noRelated,
  noMatch: labels.noMatchingPage,
};

/**
 * The related pages: every page that evokes the entity, the passages of its mentions counted
 * written and recognised alike. Three regimes by the number of mentions: all inline up to
 * `initial`; beyond it and under `MENTIONS_EMBEDDED_MAX`, the rest travels in a JSON script
 * block the island reads; from there on, the island fetches the fragment of the entity, and a
 * link to it stands meanwhile. The block is served open: where the panel folds, this one is
 * what the reader came for.
 */
export function MentionsPanel({
  mentions,
  initial,
  pages,
  labels: given,
  fragmentHref,
}: MentionsPanelProps): JSX.Element {
  const inline = mentions.slice(0, initial);
  const rest = mentions.slice(initial);
  const embedded = rest.length > 0 && mentions.length < MENTIONS_EMBEDDED_MAX;
  const total = pages ?? groupByPage(mentions).length;
  // Nothing to filter or load without a mention: the empty block stands without the island.
  const Body = mentions.length === 0 ? MentionsIsland : MentionsBody;
  const text = { ...defaultRelatedLabels, ...given };
  return (
    <aside class="mentions panel-block" aria-labelledby="mentions-title">
      <details class="panel-fold" open>
        <summary>
          <h2 id="mentions-title">
            {text.related} <span class="count">{total}</span>
          </h2>
        </summary>
        <Body
          mentions={inline}
          total={mentions.length}
          pages={total}
          labels={text}
          {...(fragmentHref === undefined ? {} : { fragmentHref })}
        />
      </details>
      {embedded && (
        <script
          type="application/json"
          id={MENTIONS_EMBEDDED}
          dangerouslySetInnerHTML={{ __html: embedMentions(rest) }}
        />
      )}
    </aside>
  );
}
