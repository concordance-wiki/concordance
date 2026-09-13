import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { Mention, MentionsPanelProps } from "../../slots.js";
import { labels } from "./labels.js";
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

/**
 * Three regimes by the number of mentions: all inline up to `initial`; beyond it and under
 * `MENTIONS_EMBEDDED_MAX`, the rest travels in a JSON script block the island reads; from there
 * on, the island fetches the fragment of the entity, and a link to it stands meanwhile.
 */
export function MentionsPanel({
  mentions,
  initial,
  headings,
  fragmentHref,
}: MentionsPanelProps): JSX.Element {
  const inline = mentions.slice(0, initial);
  const rest = mentions.slice(initial);
  const embedded = rest.length > 0 && mentions.length < MENTIONS_EMBEDDED_MAX;
  const counts = {
    written: mentions.filter((mention) => mention.kind === "written").length,
    recognised: mentions.filter((mention) => mention.kind === "recognised").length,
  };
  // Nothing to sort, filter or load without a mention: the empty sections stand without the island.
  const Body = mentions.length === 0 ? MentionsIsland : MentionsBody;
  return (
    <aside class="mentions" aria-labelledby="mentions-title">
      <h2 id="mentions-title">
        {labels.mentions} <span class="count">{mentions.length}</span>
      </h2>
      <Body
        mentions={inline}
        total={mentions.length}
        counts={counts}
        headings={
          headings ?? { written: labels.writtenInNotes, recognised: labels.recognisedInFiles }
        }
        {...(fragmentHref === undefined ? {} : { fragmentHref })}
      />
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
