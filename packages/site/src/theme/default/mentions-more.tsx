import { Component, type JSX } from "preact";

import type { Mention } from "../../slots.js";
import { labels } from "./labels.js";
import { MentionList } from "./mention-list.js";

export interface MentionsMoreProps {
  mentions: Mention[];
}

interface MentionsMoreState {
  /** False in the served HTML and until the island mounts: the rest stays reachable in a details element. */
  hydrated: boolean;
  expanded: boolean;
}

/** The mentions beyond the inline threshold: a details element without JavaScript, a button once hydrated. */
export class MentionsMore extends Component<MentionsMoreProps, MentionsMoreState> {
  override state: MentionsMoreState = { hydrated: false, expanded: false };

  override componentDidMount(): void {
    this.setState({ hydrated: true });
  }

  reveal = (): void => {
    this.setState({ expanded: true });
  };

  override render(
    props: Readonly<MentionsMoreProps>,
    state: Readonly<MentionsMoreState>,
  ): JSX.Element {
    const summary = `${labels.showRemaining} (${String(props.mentions.length)})`;
    if (!state.hydrated) {
      return (
        <details class="mentions-more">
          <summary>{summary}</summary>
          <MentionList mentions={props.mentions} />
        </details>
      );
    }
    if (!state.expanded) {
      return (
        <div class="mentions-more">
          <button type="button" aria-expanded="false" onClick={this.reveal}>
            {summary}
          </button>
        </div>
      );
    }
    return (
      <div class="mentions-more">
        <MentionList mentions={props.mentions} />
      </div>
    );
  }
}

export const MENTIONS_ISLAND = "mentions-panel";
