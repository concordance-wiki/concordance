import type { JSX } from "preact";

import type { Mention } from "../../slots.js";
import { labels } from "./labels.js";

/** Mentions of one kind, each linking to its passage; shared by the static panel and the island. */
export function MentionList({ mentions }: { mentions: Mention[] }): JSX.Element {
  return (
    <ul class="mention-list">
      {mentions.map((mention) => (
        <li key={mention.href} class={`mention mention-${mention.kind}`}>
          <a class="mention-file" href={mention.file.href}>
            {mention.file.label}
          </a>{" "}
          <a class="mention-passage" href={mention.href}>
            {labels.line} {mention.line}
          </a>
          <q class="mention-context">{mention.context}</q>
        </li>
      ))}
    </ul>
  );
}
