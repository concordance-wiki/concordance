import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { Mention, MentionsPanelProps } from "../../slots.js";
import { labels } from "./labels.js";
import { MentionList } from "./mention-list.js";
import { MENTIONS_ISLAND, MentionsMore } from "./mentions-more.js";

// Created here rather than next to the component, so that the hydration entry bundles no server-side helper.
const MentionsMoreIsland = island(MENTIONS_ISLAND, MentionsMore);

function Group({
  id,
  title,
  empty,
  mentions,
}: {
  id: string;
  title: string;
  empty: string;
  mentions: Mention[];
}): JSX.Element {
  return (
    <section class="mentions-group" aria-labelledby={id}>
      <h3 id={id}>
        {title} <span class="count">{mentions.length}</span>
      </h3>
      {mentions.length === 0 ? <p class="empty">{empty}</p> : <MentionList mentions={mentions} />}
    </section>
  );
}

export function MentionsPanel({ mentions, initial }: MentionsPanelProps): JSX.Element {
  const inline = mentions.slice(0, initial);
  const rest = mentions.slice(initial);
  return (
    <aside class="mentions" aria-labelledby="mentions-title">
      <h2 id="mentions-title">
        {labels.mentions} <span class="count">{mentions.length}</span>
      </h2>
      <Group
        id="mentions-written"
        title={labels.writtenInNotes}
        empty={labels.noWrittenMention}
        mentions={inline.filter((mention) => mention.kind === "written")}
      />
      <Group
        id="mentions-recognised"
        title={labels.recognisedInFiles}
        empty={labels.noRecognisedMention}
        mentions={inline.filter((mention) => mention.kind === "recognised")}
      />
      {rest.length > 0 && <MentionsMoreIsland mentions={rest} />}
    </aside>
  );
}
