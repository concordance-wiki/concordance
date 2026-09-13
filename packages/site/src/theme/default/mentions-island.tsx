import { Component, type JSX, type TargetedEvent } from "preact";

import type { Mention, RelatedLabels } from "../../slots.js";
import {
  fill,
  groupByPage,
  matchesFilter,
  RelatedList,
  typeCounts,
  type RelatedPage,
} from "./mention-list.js";

export const MENTIONS_ISLAND = "mentions-panel";

/**
 * Below this many mentions in all, those beyond the inline ones travel in the page, inside a
 * JSON script block; from it on, the island fetches the fragment of the entity on demand.
 */
export const MENTIONS_EMBEDDED_MAX = 200;

/** The id of the JSON script block holding the embedded mentions; one panel per page, so one id. */
export const MENTIONS_EMBEDDED = "mentions-embedded";

/** Where the mentions beyond the inline ones come from once the island runs; never serialised. */
export type MentionsRest =
  | { kind: "embedded"; mentions: Mention[] }
  | { kind: "fetch"; load: () => Promise<Mention[]> }
  /** Over `file://` the fragment cannot be fetched: the reader gets a link to it. */
  | { kind: "link" };

export interface MentionsIslandProps {
  /** The inline mentions, written links first, then recognised ones, each in corpus order. */
  mentions: Mention[];
  /** How many mentions the entity has in all, the inline ones included. */
  total: number;
  /** How many pages cite the entity in all. */
  pages: number;
  labels: RelatedLabels;
  fragmentHref?: string;
  rest?: MentionsRest;
  /** A type slug whose pages come first, whatever their count. */
  leadType?: string;
}

type Loading = "idle" | "loading" | "failed";

export interface MentionsIslandState {
  /** False in the served HTML and until the island mounts: the controls exist only once it runs. */
  hydrated: boolean;
  filter: string;
  /** The type slugs the reader unticked; every type shows when none is. */
  hidden: string[];
  /** Every mention once the rest was obtained; the inline ones until then. */
  loaded?: Mention[];
  loading: Loading;
}

/**
 * The body of the related pages block: one entry per page that evokes the entity, most passages
 * first; a text filter, a type filter and the loading of the other pages once mounted.
 */
export class MentionsIsland extends Component<MentionsIslandProps, MentionsIslandState> {
  constructor(props: MentionsIslandProps) {
    super(props);
    this.state = { hydrated: false, filter: "", hidden: [], loading: "idle" };
  }

  override componentDidMount(): void {
    this.setState({ hydrated: true });
  }

  /** Every mention the island currently holds. */
  all(): Mention[] {
    return this.state.loaded ?? this.props.mentions;
  }

  /** Every page the island holds, then those the filters keep. */
  pages(): { all: RelatedPage[]; shown: RelatedPage[] } {
    const { filter, hidden } = this.state;
    const all = groupByPage(this.all(), this.props.leadType);
    const shown = all.filter(
      (page) =>
        matchesFilter(page, filter) && (page.type === undefined || !hidden.includes(page.type)),
    );
    return { all, shown };
  }

  changeFilter = (event: TargetedEvent<HTMLInputElement>): void => {
    this.setState({ filter: event.currentTarget.value });
  };

  toggleType = (type: string, shown: boolean): void => {
    this.setState((state) => ({
      hidden: shown ? state.hidden.filter((slug) => slug !== type) : [...state.hidden, type],
    }));
  };

  clearTypes = (): void => {
    this.setState({ hidden: [] });
  };

  receive(mentions: Mention[]): void {
    this.setState({ loaded: mentions, loading: "idle" });
  }

  loadRest = (): void => {
    const { rest } = this.props;
    if (rest === undefined || rest.kind === "link") return;
    if (rest.kind === "embedded") {
      this.receive([...this.props.mentions, ...rest.mentions]);
      return;
    }
    this.setState({ loading: "loading" });
    rest.load().then(
      (mentions) => {
        this.receive(mentions);
      },
      () => {
        this.setState({ loading: "failed" });
      },
    );
  };

  private typeFilter(all: RelatedPage[], shown: RelatedPage[]): JSX.Element | null {
    const { labels } = this.props;
    const { hidden } = this.state;
    const types = typeCounts(all);
    if (types.length === 0) return null;
    const active = types.length - hidden.length;
    return (
      <details class="related-types">
        <summary>
          {labels.types} <span class="count">{active}</span>
        </summary>
        <div class="related-type-menu">
          <ul class="related-type-list">
            {types.map((type) => (
              <li key={type.type}>
                <label>
                  <input
                    type="checkbox"
                    checked={!hidden.includes(type.type)}
                    onChange={(event: TargetedEvent<HTMLInputElement>) => {
                      this.toggleType(type.type, event.currentTarget.checked);
                    }}
                  />{" "}
                  {type.label} <span class="count">{type.count}</span>
                </label>
              </li>
            ))}
          </ul>
          <p class="related-type-summary">
            <output>{fill(labels.pagesOf, { shown: shown.length, total: all.length })}</output>
            <button type="button" class="related-clear" onClick={this.clearTypes}>
              {labels.clearAll}
            </button>
          </p>
        </div>
      </details>
    );
  }

  private controls(all: RelatedPage[], shown: RelatedPage[]): JSX.Element {
    const { labels } = this.props;
    return (
      <div class="mentions-controls" role="group" aria-label={labels.related}>
        <label class="related-filter">
          <span class="visually-hidden">{labels.filterPages}</span>
          <input
            type="search"
            placeholder={labels.filterPages}
            value={this.state.filter}
            onInput={this.changeFilter}
          />
        </label>
        {this.typeFilter(all, shown)}
      </div>
    );
  }

  /** The way to the pages beyond the inline mentions: a link to the fragment until the island runs, a button once it can load them. */
  private more(shownPages: number): JSX.Element | null {
    const { total, mentions, pages, fragmentHref, rest, labels } = this.props;
    const { hydrated, loaded, loading } = this.state;
    if (total <= mentions.length || loaded !== undefined) return null;
    const link =
      fragmentHref === undefined ? null : (
        <a href={fragmentHref}>
          {labels.fullList} ({total})
        </a>
      );
    if (!hydrated || rest === undefined || rest.kind === "link") {
      return link === null ? null : <p class="mentions-more">{link}</p>;
    }
    if (loading === "failed") {
      return (
        <p class="mentions-more" role="status">
          {labels.othersUnavailable} {link}
        </p>
      );
    }
    return (
      <p class="mentions-more">
        <button type="button" disabled={loading === "loading"} onClick={this.loadRest}>
          {loading === "loading"
            ? labels.loadingOthers
            : fill(labels.showOthers, { count: Math.max(pages - shownPages, 1) })}
        </button>
      </p>
    );
  }

  override render(): JSX.Element {
    const { labels } = this.props;
    const { hydrated } = this.state;
    const { all, shown } = this.pages();
    return (
      <div class="mentions-body">
        {hydrated && this.controls(all, shown)}
        {all.length === 0 ? (
          <p class="empty">{labels.noRelated}</p>
        ) : shown.length === 0 ? (
          <p class="empty" role="status">
            {labels.noMatch}
          </p>
        ) : (
          <RelatedList pages={shown} labels={labels} />
        )}
        {this.more(all.length)}
        {all.length > 0 && labels.leadNote !== undefined && (
          <p class="related-note related-lead-note">{labels.leadNote}</p>
        )}
        {all.length > 0 && <p class="related-note">{labels.orderNote}</p>}
      </div>
    );
  }
}
