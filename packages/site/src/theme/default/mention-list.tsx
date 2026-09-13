import type { JSX, TargetedEvent } from "preact";

import type { Link, Mention } from "../../slots.js";
import { labels } from "./labels.js";

/** The mentions of one file and one kind, in line order; the key names both, unique in the panel. */
export interface MentionGroup {
  key: string;
  file: Link;
  mentions: Mention[];
}

export type MentionSort = "file" | "count" | "line";

export const MENTION_SORTS: readonly MentionSort[] = ["file", "count", "line"];

/** Groups mentions by file in the order the files first appear: the corpus order of the build. */
export function groupByFile(mentions: readonly Mention[]): MentionGroup[] {
  const groups = new Map<string, MentionGroup>();
  for (const mention of mentions) {
    const key = `${mention.kind} ${mention.file.href}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { key, file: mention.file, mentions: [mention] });
    } else {
      group.mentions.push(mention);
    }
  }
  return [...groups.values()];
}

/** The groups reordered; `file` keeps the build order, the other keys are stable on ties. */
export function sortGroups(groups: readonly MentionGroup[], sort: MentionSort): MentionGroup[] {
  const sorted = [...groups];
  if (sort === "count") {
    sorted.sort((a, b) => b.mentions.length - a.mentions.length);
  } else if (sort === "line") {
    const earliest = (group: MentionGroup): number =>
      group.mentions.reduce((line, mention) => Math.min(line, mention.line), Infinity);
    sorted.sort((a, b) => earliest(a) - earliest(b));
  }
  return sorted;
}

/** Whether a mention matches a filter typed by the reader: on the file path and on the context, without regard to case. */
export function matchesFilter(mention: Mention, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return (
    needle === "" ||
    mention.file.label.toLowerCase().includes(needle) ||
    mention.context.toLowerCase().includes(needle)
  );
}

/** The context of a mention, the words naming the entity marked when the build found them. */
export function Context({ mention }: { mention: Mention }): JSX.Element {
  const { context, surface } = mention;
  const at = surface === undefined ? -1 : context.indexOf(surface);
  if (surface === undefined || at < 0) {
    return <q class="mention-context">{context}</q>;
  }
  return (
    <q class="mention-context">
      {context.slice(0, at)}
      <mark>{surface}</mark>
      {context.slice(at + surface.length)}
    </q>
  );
}

export interface MentionGroupsProps {
  groups: readonly MentionGroup[];
  /** Whether the group of that key is open; a key absent from the record is closed. */
  open: Readonly<Record<string, boolean>>;
  onToggle?: (key: string, open: boolean) => void;
}

/** One collapsible block per file: its path and count in the summary, its mentions in line order inside, each linking to the passage. */
export function MentionGroups({ groups, open, onToggle }: MentionGroupsProps): JSX.Element {
  return (
    <div class="mention-groups">
      {groups.map((group) => (
        <details
          key={group.key}
          class="mention-group"
          open={open[group.key] === true}
          onToggle={
            onToggle === undefined
              ? undefined
              : (event: TargetedEvent<HTMLDetailsElement>) => {
                  onToggle(group.key, event.currentTarget.open);
                }
          }
        >
          {/* No link inside the summary, which is interactive itself: the passages lead to the page of the file. */}
          <summary>
            <span class="mention-file">{group.file.label}</span>{" "}
            <span class="count">{group.mentions.length}</span>
          </summary>
          <ul class="mention-list">
            {group.mentions.map((mention, index) => (
              <li key={index} class={`mention mention-${mention.kind}`}>
                <a class="mention-passage" href={mention.href}>
                  {labels.line} {mention.line}
                </a>{" "}
                <Context mention={mention} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
