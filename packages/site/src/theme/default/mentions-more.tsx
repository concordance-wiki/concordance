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

/** The id of the list the button controls; one mentions panel per page, so one id. */
export const MENTIONS_MORE_LIST = "mentions-more-list";

/** The mentions beyond the inline threshold: a details element without JavaScript, a disclosure button once hydrated. */
export class MentionsMore extends Component<MentionsMoreProps, MentionsMoreState> {
  override state: MentionsMoreState = { hydrated: false, expanded: false };

  override componentDidMount(): void {
    this.setState({ hydrated: true });
  }

  toggle = (): void => {
    this.setState((state) => ({ expanded: !state.expanded }));
  };

  override render(
    props: Readonly<MentionsMoreProps>,
    state: Readonly<MentionsMoreState>,
  ): JSX.Element {
    const count = `(${String(props.mentions.length)})`;
    if (!state.hydrated) {
      return (
        <details class="mentions-more">
          <summary>
            {labels.showRemaining} {count}
          </summary>
          <MentionList mentions={props.mentions} />
        </details>
      );
    }
    return (
      <div class="mentions-more">
        <button
          type="button"
          aria-expanded={state.expanded ? "true" : "false"}
          aria-controls={MENTIONS_MORE_LIST}
          onClick={this.toggle}
        >
          {state.expanded ? labels.hideRemaining : labels.showRemaining} {count}
        </button>
        <div id={MENTIONS_MORE_LIST} hidden={!state.expanded}>
          <MentionList mentions={props.mentions} />
        </div>
      </div>
    );
  }
}

export const MENTIONS_ISLAND = "mentions-panel";
