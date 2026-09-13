import { Component, type JSX, type TargetedEvent } from "preact";

import type { Mention, MentionsHeadings } from "../../slots.js";
import { labels } from "./labels.js";
import {
  groupByFile,
  matchesFilter,
  MENTION_SORTS,
  MentionGroups,
  sortGroups,
  type MentionGroup,
  type MentionSort,
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
  /** How many mentions the entity has in all, the inline ones included, and how many of each kind. */
  total: number;
  counts: Record<Mention["kind"], number>;
  headings: MentionsHeadings;
  fragmentHref?: string;
  rest?: MentionsRest;
}

type Loading = "idle" | "loading" | "failed";

export interface MentionsIslandState {
  /** False in the served HTML and until the island mounts: the controls exist only once it runs. */
  hydrated: boolean;
  sort: MentionSort;
  filter: string;
  /** The open state of every group by key; the first group of each section starts open. */
  open: Record<string, boolean>;
  /** Every mention once the rest was obtained; the inline ones until then. */
  loaded?: Mention[];
  loading: Loading;
}

interface Section {
  kind: Mention["kind"];
  id: string;
  title: string;
  empty: string;
  groups: MentionGroup[];
  /** The number the heading shows: every mention of the kind, or the matching ones under a filter. */
  count: number;
  /** What stands in place of the groups when there is none: the empty message, the filter message, or nothing when the rest holds them. */
  placeholder: string | undefined;
}

function isSort(value: string): value is MentionSort {
  return (MENTION_SORTS as readonly string[]).includes(value);
}

/** The first group of each section open, every other closed. */
export function initialOpen(mentions: readonly Mention[]): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  for (const kind of ["written", "recognised"] as const) {
    const groups = groupByFile(mentions.filter((mention) => mention.kind === kind));
    groups.forEach((group, index) => {
      open[group.key] = index === 0;
    });
  }
  return open;
}

/** The body of the mentions panel: two sections of collapsible file groups; controls, sorting, filtering and loading once mounted. */
export class MentionsIsland extends Component<MentionsIslandProps, MentionsIslandState> {
  constructor(props: MentionsIslandProps) {
    super(props);
    this.state = {
      hydrated: false,
      sort: "file",
      filter: "",
      open: initialOpen(props.mentions),
      loading: "idle",
    };
  }

  override componentDidMount(): void {
    this.setState({ hydrated: true });
  }

  /** Every mention the island currently holds. */
  all(): Mention[] {
    return this.state.loaded ?? this.props.mentions;
  }

  sections(): Section[] {
    const { sort, filter } = this.state;
    const all = this.all();
    const section = (kind: Mention["kind"], id: string, title: string, empty: string): Section => {
      const ofKind = all.filter((mention) => mention.kind === kind);
      const shown = ofKind.filter((mention) => matchesFilter(mention, filter));
      const filtering = filter.trim() !== "";
      const total = this.props.counts[kind];
      return {
        kind,
        id,
        title,
        empty,
        groups: sortGroups(groupByFile(shown), sort),
        count: filtering ? shown.length : total,
        placeholder:
          total === 0
            ? empty
            : filtering && shown.length === 0
              ? labels.noMatchingMention
              : undefined,
      };
    };
    return [
      section("written", "mentions-written", this.props.headings.written, labels.noWrittenMention),
      section(
        "recognised",
        "mentions-recognised",
        this.props.headings.recognised,
        labels.noRecognisedMention,
      ),
    ];
  }

  toggleGroup = (key: string, open: boolean): void => {
    this.setState((state) => ({ open: { ...state.open, [key]: open } }));
  };

  /** Collapses every group when any is open, expands them all otherwise. */
  toggleAll = (): void => {
    const keys = groupByFile(this.all()).map((group) => group.key);
    const anyOpen = keys.some((key) => this.state.open[key] === true);
    this.setState({ open: Object.fromEntries(keys.map((key) => [key, !anyOpen])) });
  };

  changeSort = (event: TargetedEvent<HTMLSelectElement>): void => {
    const { value } = event.currentTarget;
    if (isSort(value)) this.setState({ sort: value });
  };

  changeFilter = (event: TargetedEvent<HTMLInputElement>): void => {
    this.setState({ filter: event.currentTarget.value });
  };

  /** Adds the rest to the inline mentions; new groups start closed, unless their section had none so far. */
  receive(mentions: Mention[]): void {
    this.setState((state) => ({
      loaded: mentions,
      loading: "idle",
      open: {
        ...Object.fromEntries(groupByFile(mentions).map((group) => [group.key, false])),
        ...initialOpen(
          mentions.filter(
            (mention) => !this.props.mentions.some((inline) => inline.kind === mention.kind),
          ),
        ),
        ...state.open,
      },
    }));
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

  private controls(sections: Section[]): JSX.Element {
    const { sort, filter, open } = this.state;
    const keys = sections.flatMap((section) => section.groups.map((group) => group.key));
    const anyOpen = keys.some((key) => open[key] === true);
    return (
      <div class="mentions-controls" role="group" aria-label={labels.mentionsControls}>
        <label>
          {labels.sortBy}{" "}
          <select value={sort} onChange={this.changeSort}>
            <option value="file">{labels.sortByFile}</option>
            <option value="count">{labels.sortByCount}</option>
            <option value="line">{labels.sortByLine}</option>
          </select>
        </label>
        <label>
          {labels.filter} <input type="search" value={filter} onInput={this.changeFilter} />
        </label>
        <button type="button" onClick={this.toggleAll}>
          {anyOpen ? labels.collapseAll : labels.expandAll}
        </button>
      </div>
    );
  }

  /** The way to the mentions beyond the inline ones: a link to the fragment until the island runs, a button once it can load them. */
  private more(): JSX.Element | null {
    const { total, mentions, fragmentHref, rest } = this.props;
    const { hydrated, loaded, loading } = this.state;
    const remaining = total - mentions.length;
    if (remaining <= 0 || loaded !== undefined) return null;
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
          {labels.remainingUnavailable}. {link}
        </p>
      );
    }
    return (
      <p class="mentions-more">
        <button type="button" disabled={loading === "loading"} onClick={this.loadRest}>
          {loading === "loading" ? labels.loadingRemaining : labels.showRemaining} (
          {String(remaining)})
        </button>
      </p>
    );
  }

  override render(): JSX.Element {
    const { hydrated, filter, open } = this.state;
    const sections = this.sections();
    const shown = sections.reduce(
      (count, section) =>
        count + section.groups.reduce((sum, group) => sum + group.mentions.length, 0),
      0,
    );
    return (
      <div class="mentions-body">
        {hydrated && this.controls(sections)}
        {hydrated && filter.trim() !== "" && (
          <p class="mentions-status" role="status">
            {shown} {labels.of} {this.all().length} {labels.mentionsShown}
          </p>
        )}
        {sections.map((section) => (
          <section key={section.id} class="mentions-group" aria-labelledby={section.id}>
            <h3 id={section.id}>
              {section.title} <span class="count">{section.count}</span>
            </h3>
            {section.groups.length === 0 ? (
              section.placeholder !== undefined && <p class="empty">{section.placeholder}</p>
            ) : (
              <MentionGroups
                groups={section.groups}
                open={open}
                {...(hydrated ? { onToggle: this.toggleGroup } : {})}
              />
            )}
          </section>
        ))}
        {this.more()}
      </div>
    );
  }
}
