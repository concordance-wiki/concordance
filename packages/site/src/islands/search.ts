import { h, type JSX } from "preact";

import { activeFiltersOf, countFacets, facetsOf, filterEntries } from "../search/facets.js";
import {
  plural,
  queryWords,
  rank,
  SEARCH_DIRECTORY,
  SEARCH_META,
  shardHref,
  shardOf,
  type SearchEntry,
  type SearchIslandProps,
  type SearchMeta,
  type ShardData,
} from "../search/shared.js";
import {
  clearFilters,
  parseSearchState,
  searchQueryString,
  withQuery,
  type SearchState,
} from "../search/state.js";
import type { SearchResult, SearchResultsProps } from "../slots.js";
import { ResultList } from "../theme/default/result-list.js";
import { SearchResults } from "../theme/default/search-results.js";

/** How many results the suggestions under the header field show; the results page shows them all. */
export const SUGGESTIONS = 8;

/** Adds a classic script to the page and says whether it loaded; a missing shard is an error, not a failure. */
export type ScriptInjector = (src: string, done: (loaded: boolean) => void) => void;

/** The callback every index file calls with its name and its data. */
export interface ShardReceiver {
  shard(name: string, data: unknown): void;
}

/** The window, as far as the loader needs it: the global the index files call back. */
export interface ShardHost {
  __concordanceSearch?: ShardReceiver;
}

declare global {
  interface Window {
    __concordanceSearch?: ShardReceiver;
  }
}

/** Loads an index file once, whatever the number of callers, through a script the browser accepts over `file://`. */
export type ShardLoader = (name: string) => Promise<unknown>;

/**
 * The loader of the index files of one page: each file is a classic script calling
 * `window.__concordanceSearch.shard(name, data)`, so the loader exposes that global, injects
 * the script, and resolves when the callback comes; a script that fails to load resolves to
 * nothing. Loaded files are kept, so that a prefix typed again costs no request.
 */
export function shardLoader(index: string, inject: ScriptInjector, host: ShardHost): ShardLoader {
  const loaded = new Map<string, Promise<unknown>>();
  const pending = new Map<string, (data: unknown) => void>();
  host.__concordanceSearch = {
    shard: (name, data) => {
      pending.get(name)?.(data);
      pending.delete(name);
    },
  };
  return (name) => {
    const known = loaded.get(name);
    if (known !== undefined) {
      return known;
    }
    const promise = new Promise<unknown>((resolve) => {
      pending.set(name, resolve);
      inject(shardHref(index, name), (ok) => {
        if (!ok) {
          pending.delete(name);
          resolve(undefined);
        }
      });
    });
    loaded.set(name, promise);
    return promise;
  };
}

/** One entity a query matched, with its score; every entity, scored 0, for a query without a word. */
export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

export interface SearchOutcome {
  query: string;
  /** Every match, best first. */
  hits: SearchHit[];
  /** The entity table; absent when the site has no index or its table failed to load. */
  meta?: SearchMeta;
}

/** Runs a query against the index of a site: the entity table once, then one shard per word. */
export type SearchRunner = (query: string) => Promise<SearchOutcome>;

/**
 * The hits of a query over the loaded files: the ranked entities for a query with words, the
 * whole table in its order for a query without, so that the results page lists the site under
 * the facets alone.
 */
export function hitsOf(
  query: string,
  meta: SearchMeta,
  shards: ReadonlyMap<string, ShardData>,
): SearchHit[] {
  const words = queryWords(query);
  if (words.length === 0) {
    return meta.entities.map((entry) => ({ entry, score: 0 }));
  }
  return rank(words, shards).flatMap(({ entity, score }) => {
    const entry = meta.entities[entity];
    return entry === undefined ? [] : [{ entry, score }];
  });
}

/** A hit as the lists show it: the title, the type badge, the breadcrumb and the href from the page through `root`. */
export function resultOf(entry: SearchEntry, meta: SearchMeta, root: string): SearchResult {
  const breadcrumb = [
    entry.application === undefined ? undefined : meta.applications[entry.application],
    entry.domain === undefined ? undefined : meta.domains[entry.domain],
  ].filter((part) => part !== undefined);
  const typeLabel = meta.types[entry.type];
  return {
    title: entry.title,
    href: `${root}${entry.url}`,
    ...(typeLabel === undefined ? {} : { typeLabel }),
    ...(breadcrumb.length === 0 ? {} : { breadcrumb }),
  };
}

/**
 * The runner of one page: loads `meta` on the first call, then the shard of every word of the
 * query that the table lists, and ranks. A word whose shard the table does not list matches
 * nothing without a request.
 */
export function searchRunner(root: string, inject: ScriptInjector, host: ShardHost): SearchRunner {
  const load = shardLoader(`${root}${SEARCH_DIRECTORY}/`, inject, host);
  const shards = new Map<string, ShardData>();
  return async (query) => {
    // Written by the build: the files carry the shapes the index builder serialises.
    const meta = (await load(SEARCH_META)) as SearchMeta | undefined;
    if (meta === undefined) {
      return { query, hits: [] };
    }
    const wanted = queryWords(query)
      .map(shardOf)
      .filter((name) => meta.shards.includes(name) && !shards.has(name));
    await Promise.all(
      [...new Set(wanted)].map(async (name) => {
        // Written by the build: the files carry the shapes the index builder serialises.
        const data = (await load(name)) as ShardData | undefined;
        shards.set(name, data ?? {});
      }),
    );
    return { query, hits: hitsOf(query, meta, shards), meta };
  };
}

/** The key of a keyboard event and what it takes to decide whether the shortcut applies. */
export interface KeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: unknown;
  preventDefault(): void;
}

/** Elements whose keystrokes are text: the `/` shortcut leaves them alone. */
export function isEditable(target: unknown): boolean {
  if (typeof target !== "object" || target === null) {
    return false;
  }
  // An object, as checked above; both properties are read as unknown and tested before use.
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  return (
    element.isContentEditable === true ||
    (typeof element.tagName === "string" &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName.toUpperCase()))
  );
}

export interface SearchInput {
  value: string;
  focus(): void;
  blur(): void;
  addEventListener(type: "input" | "focus", listener: () => void): void;
  addEventListener(type: "keydown", listener: (event: KeyEvent) => void): void;
}

export interface SearchDocument {
  addEventListener(type: "keydown", listener: (event: KeyEvent) => void): void;
}

/** `/` anywhere but in a text control focuses the field; `Escape` in the field leaves it. */
export function wireShortcuts(
  document: SearchDocument,
  input: SearchInput,
  onEscape: () => void = () => undefined,
): void {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (isEditable(event.target)) {
      return;
    }
    event.preventDefault();
    input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.blur();
      onEscape();
    }
  });
}

/** Where a list is drawn: the suggestions panel of the header, or the island of the results page. */
export interface SearchPanel {
  hidden: boolean;
}

export interface SearchIslandElement<P extends SearchPanel> {
  getAttribute(name: string): string | null;
  /** The field of the header island, none on the results island. */
  input(): SearchInput | null;
  /** The suggestions panel of the header island, none on the results island. */
  panel(): P | null;
  /** The island itself, which the results page renders into. */
  container(): P;
}

/** The address of the page, as far as the island reads and writes it: its query string. */
export interface SearchLocation {
  /** The query string of the address, `?q=…` or empty. */
  search(): string;
  /** The whole address, what the copy button puts in the clipboard. */
  href(): string;
  /** Adds an entry to the history with this query string, the page staying. */
  push(search: string): void;
  /** Rewrites the current entry of the history with this query string, as the reader types. */
  replace(search: string): void;
  /** Called when the reader goes back or forward: the address changed under the page. */
  onPop(listener: () => void): void;
}

/** What the page remembers and restores of its scroll, by address, so that a link opens where it was left. */
export interface ScrollMemory {
  /** The position remembered for an address, none the first time. */
  remembered(search: string): number | undefined;
  remember(search: string, position: number): void;
  position(): number;
  scrollTo(position: number): void;
  onScroll(listener: () => void): void;
}

/** The part of a web storage the scroll memory uses; `sessionStorage` in the browser. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The part of the window the scroll memory reads and drives. */
export interface ScrollView {
  scrollY: number;
  scrollTo(x: number, y: number): void;
  addEventListener(type: "scroll", listener: () => void): void;
}

/** The storage a getter gives, or none when the page cannot reach it, as some browsers refuse it over `file://`. */
export function storageOf(get: () => KeyValueStorage): KeyValueStorage | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}

/** Prefix of the keys the scroll memory writes, one per query string. */
export const SCROLL_KEY = "concordance-search-scroll:";

/** The scroll memory of a page over a web storage; without one, nothing is remembered and the page opens at the top. */
export function scrollMemory(storage: KeyValueStorage | undefined, view: ScrollView): ScrollMemory {
  return {
    remembered: (search) => {
      const value = Number(storage?.getItem(`${SCROLL_KEY}${search}`) ?? "x");
      return Number.isFinite(value) ? value : undefined;
    },
    remember: (search, position) => {
      try {
        storage?.setItem(`${SCROLL_KEY}${search}`, String(position));
      } catch {
        // A full or refused storage loses the position and nothing else.
      }
    },
    position: () => view.scrollY,
    scrollTo: (position) => {
      view.scrollTo(0, position);
    },
    onScroll: (listener) => {
      view.addEventListener("scroll", listener);
    },
  };
}

/** The clipboard, when the page has one: secure contexts only, so not over `file://` in every browser. */
export interface SearchClipboard {
  writeText(text: string): Promise<void>;
}

/** Runs a callback after a delay in milliseconds and gives back what cancels it: `setTimeout` in the browser. */
export type Defer = (callback: () => void, delay: number) => () => void;

/** How long the address waits for the reader to stop typing before it is rewritten. */
export const REPLACE_DELAY = 300;

export interface SearchIslands<P extends SearchPanel> {
  islands: Iterable<SearchIslandElement<P>>;
  document: SearchDocument;
  location: SearchLocation;
  scroll: ScrollMemory;
  clipboard: SearchClipboard | undefined;
  defer: Defer;
  inject: ScriptInjector;
  host: ShardHost;
  render(vnode: JSX.Element, container: P): void;
}

/** The href of a state from the results page: its query string, `?` alone for the empty state so that the link stays a link. */
export function resultsHref(state: SearchState): string {
  const search = searchQueryString(state);
  return search === "" ? "?" : search;
}

/** The address of a state from the root of the site, as the results page shows it. */
export function resultsAddress(state: SearchState): string {
  return `${SEARCH_DIRECTORY}/index.html${searchQueryString(state)}`;
}

/** What the results page does beyond showing: follows an address in place, copies the current one. */
export interface ResultsActions {
  onNavigate: (href: string) => void;
  onCopy?: () => void;
  copied?: boolean;
}

/** The view model of the results page for a state and the hits of its query, facets counted over those hits. */
export function resultsPropsOf(
  state: SearchState,
  outcome: SearchOutcome,
  root: string,
  actions: ResultsActions,
): SearchResultsProps {
  const { meta } = outcome;
  if (meta === undefined) {
    return { query: state.query, total: 0, results: [], facets: [] };
  }
  const entries = outcome.hits.map((hit) => hit.entry);
  const kept = filterEntries(entries, (entry) => entry, state);
  const hrefOf = resultsHref;
  const filters = activeFiltersOf(meta, state, hrefOf);
  return {
    query: state.query,
    total: kept.length,
    results: kept.map((entry) => resultOf(entry, meta, root)),
    facets: facetsOf(meta, state, countFacets(entries, state), hrefOf),
    summary:
      kept.length === 0
        ? meta.labels.noResult
        : plural(meta.labels.results, kept.length, meta.locale),
    ...(filters.length === 0 ? {} : { active: filters, clearHref: hrefOf(clearFilters(state)) }),
    labels: {
      facets: meta.labels.facets,
      activeFilters: meta.labels.activeFilters,
      removeFilter: meta.labels.removeFilter,
      clear: meta.labels.clear,
      address: meta.labels.address,
      copyAddress: meta.labels.copyAddress,
      copied: meta.labels.copied,
    },
    address: resultsAddress(state),
    ...actions,
  };
}

/**
 * Wires every search island of a page: the field of the header gets the shortcuts and, when the
 * site has an index, suggestions as the reader types; the results island, when the page has
 * one, shows the list for the state of the address, filtered by its facets, and follows the
 * field and the facets. Every change of state goes through the address: a facet followed
 * pushes an entry to the history, typing rewrites the current one once the reader pauses, and
 * going back replays the state of the address, the scroll position included.
 */
export function mountSearch<P extends SearchPanel>(options: SearchIslands<P>): number {
  let root: string | undefined;
  let input: SearchInput | null = null;
  let panel: P | null = null;
  let results: P | null = null;
  let mounted = 0;
  for (const element of options.islands) {
    // Written by island() at build: the attribute carries the props of the island.
    const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as SearchIslandProps;
    root ??= props.root;
    if (props.search !== undefined) {
      input = element.input();
      panel = element.panel();
    }
    if (props.results !== undefined) {
      results = element.container();
    }
    mounted += 1;
  }
  if (input === null) {
    return mounted;
  }
  const field = input;
  const suggestions = panel;
  const hide = (): void => {
    if (suggestions !== null) suggestions.hidden = true;
  };
  wireShortcuts(options.document, field, hide);
  if (root === undefined) {
    return mounted;
  }
  const site = root;
  const run = searchRunner(site, options.inject, options.host);
  let state = parseSearchState(options.location.search());
  let copied = false;
  let latest = 0;
  let cancelReplace: (() => void) | undefined;
  const draw = (target: P, answer: SearchOutcome): void => {
    const clipboard = options.clipboard;
    const actions: ResultsActions =
      clipboard === undefined
        ? { onNavigate: navigate }
        : {
            onNavigate: navigate,
            copied,
            onCopy: () => {
              clipboard.writeText(options.location.href()).then(
                () => {
                  copied = true;
                  draw(target, answer);
                },
                () => undefined,
              );
            },
          };
    options.render(h(SearchResults, resultsPropsOf(state, answer, site, actions)), target);
  };
  const show = async (restoreScroll = false): Promise<void> => {
    const ticket = (latest += 1);
    const answer = await run(state.query);
    if (ticket !== latest) {
      return;
    }
    copied = false;
    if (results !== null) {
      draw(results, answer);
      const position = restoreScroll
        ? options.scroll.remembered(searchQueryString(state))
        : undefined;
      if (position !== undefined) options.scroll.scrollTo(position);
    } else if (suggestions !== null) {
      const meta = answer.meta;
      const shown =
        meta === undefined || queryWords(state.query).length === 0
          ? []
          : answer.hits.slice(0, SUGGESTIONS).map((hit) => resultOf(hit.entry, meta, site));
      options.render(h(ResultList, { results: shown }), suggestions);
      suggestions.hidden = shown.length === 0;
    }
  };
  const navigate = (href: string): void => {
    cancelReplace?.();
    state = parseSearchState(href);
    field.value = state.query;
    options.location.push(searchQueryString(state));
    void show();
  };
  field.addEventListener("focus", () => {
    void run("");
  });
  field.addEventListener("input", () => {
    state = withQuery(state, field.value);
    if (results !== null) {
      cancelReplace?.();
      cancelReplace = options.defer(() => {
        options.location.replace(searchQueryString(state));
      }, REPLACE_DELAY);
    }
    void show();
  });
  if (results !== null) {
    field.value = state.query;
    options.location.onPop(() => {
      cancelReplace?.();
      state = parseSearchState(options.location.search());
      field.value = state.query;
      void show(true);
    });
    options.scroll.onScroll(() => {
      options.scroll.remember(searchQueryString(state), options.scroll.position());
    });
    void show(true);
  }
  return mounted;
}
