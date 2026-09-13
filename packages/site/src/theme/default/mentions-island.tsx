import { Component, type JSX, type TargetedEvent } from "preact";

import type { Mention, RelatedLabels } from "../../slots.js";
import {
  fill,
  groupByPage,
  matchesFilter,
  RELATED_INLINE,
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

/** How many entries the panel lists on a phone before the button that shows the others. */
export const RELATED_PHONE = 2;

/** The phone layout of the stylesheet, under which the island lists two entries: the same width as its breakpoint. */
export const PHONE_QUERY = "(width < 48rem)";

/** Where the mentions beyond the inline ones come from once the island runs; never serialised. */
export type MentionsRest =
  | { kind: "embedded"; mentions: Mention[] }
  | { kind: "fetch"; load: () => Promise<Mention[]> }
  /** Over `file://` the fragment cannot be fetched: the reader gets a link to it. */
  | { kind: "link" };

export interface MentionsIslandProps {
  /** The inline mentions, in the order of the panel: page by page, most passages first. */
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
  /** Whether the reader asked for the entries beyond the first ones; every page held is listed then. */
  expanded: boolean;
  /** Whether the page is laid out for a phone, where the panel lists two entries before its button. */
  phone: boolean;
}

/** Whether the phone layout applies, read from the stylesheet's own query once the island runs; never on the server. */
function phoneLayout(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;
}

/**
 * The body of the related pages block: one entry per page that evokes the entity, most passages
 * first; a text filter, a type filter and the loading of the other pages once mounted.
 */
export class MentionsIsland extends Component<MentionsIslandProps, MentionsIslandState> {
  constructor(props: MentionsIslandProps) {
    super(props);
    this.state = {
      hydrated: false,
      filter: "",
      hidden: [],
      loading: "idle",
      expanded: false,
      phone: false,
    };
  }

  override componentDidMount(): void {
    this.setState({ hydrated: true, phone: phoneLayout() });
  }

  /** How many entries stand in view: two on a phone, six elsewhere, every one once the reader asked for the others. */
  limit(): number | undefined {
    const { expanded, phone } = this.state;
    if (expanded) return undefined;
    return phone ? RELATED_PHONE : RELATED_INLINE;
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

  /** Lists every page held and obtains the rest when there is one to obtain. */
  showOthers = (): void => {
    this.setState({ expanded: true });
    this.loadRest();
  };

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

  /** Whether every mention of the entity is held: nothing is left to obtain. */
  private complete(): boolean {
    const { total, mentions } = this.props;
    return total <= mentions.length || this.state.loaded !== undefined;
  }

  /** How many pages there are in all: the pages held once they are all held, else what the build counted. */
  private known(shown: RelatedPage[]): number {
    return this.complete() ? shown.length : Math.max(this.props.pages, shown.length);
  }

  /** The related pages, or the reason none is listed: nothing related, or nothing left by the filter. */
  private list(all: RelatedPage[], shown: RelatedPage[]): JSX.Element {
    const { labels } = this.props;
    const { hydrated } = this.state;
    if (all.length === 0) return <p class="empty">{labels.noRelated}</p>;
    if (shown.length === 0) {
      return (
        <p class="empty" role="status">
          {labels.noMatch}
        </p>
      );
    }
    const limit = this.limit();
    return (
      <RelatedList
        pages={shown}
        labels={labels}
        {...(limit === undefined ? {} : { limit })}
        total={this.known(shown)}
        beyond={!hydrated}
      />
    );
  }

  /**
   * The way to the pages beyond the entries in view: a link to the fragment until the island
   * runs, when some mentions are not held; then a button naming the other pages, which lists
   * the pages held and obtains the rest; the link again where nothing can be fetched.
   */
  private more(shown: RelatedPage[]): JSX.Element | null {
    const { total, fragmentHref, rest, labels } = this.props;
    const { hydrated, loading, expanded } = this.state;
    const complete = this.complete();
    const link =
      fragmentHref === undefined || complete ? null : (
        <a href={fragmentHref}>
          {labels.fullList} ({total})
        </a>
      );
    const linkAlone = link === null ? null : <p class="mentions-more">{link}</p>;
    if (!hydrated) return linkAlone;
    if (loading === "failed") {
      return (
        <p class="mentions-more" role="status">
          {labels.othersUnavailable} {link}
        </p>
      );
    }
    const limit = this.limit();
    const displayed = limit === undefined ? shown.length : Math.min(limit, shown.length);
    const others = this.known(shown) - displayed;
    const loadable = rest !== undefined && rest.kind !== "link";
    if (others <= 0 || (expanded && !loadable)) return linkAlone;
    return (
      <p class="mentions-more">
        <button type="button" disabled={loading === "loading"} onClick={this.showOthers}>
          {loading === "loading"
            ? labels.loadingOthers
            : fill(labels.showOthers, { count: others })}
        </button>
      </p>
    );
  }

  override render(): JSX.Element {
    const { labels } = this.props;
    const { hydrated } = this.state;
    const { all, shown } = this.pages();
    const expanded = this.limit() === undefined;
    return (
      <div class={expanded ? "mentions-body related-expanded" : "mentions-body"}>
        {hydrated && this.controls(all, shown)}
        {this.list(all, shown)}
        {this.more(shown)}
        {all.length > 0 && <p class="related-note">{labels.orderNote}</p>}
      </div>
    );
  }
}
