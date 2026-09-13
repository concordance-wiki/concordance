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
  /** Adds an entry to the history with this query string, the page staying. */
  push(search: string): void;
}

export interface SearchIslands<P extends SearchPanel> {
  islands: Iterable<SearchIslandElement<P>>;
  document: SearchDocument;
  location: SearchLocation;
  inject: ScriptInjector;
  host: ShardHost;
  render(vnode: JSX.Element, container: P): void;
}

/** The href of a state from the results page: its query string, `?` alone for the empty state so that the link stays a link. */
export function resultsHref(state: SearchState): string {
  const search = searchQueryString(state);
  return search === "" ? "?" : search;
}

/** The view model of the results page for a state and the hits of its query, facets counted over those hits. */
export function resultsPropsOf(
  state: SearchState,
  outcome: SearchOutcome,
  root: string,
  onNavigate: (href: string) => void,
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
    },
    onNavigate,
  };
}

/**
 * Wires every search island of a page: the field of the header gets the shortcuts and, when the
 * site has an index, suggestions as the reader types; the results island, when the page has
 * one, shows the list for the state of the address, filtered by its facets, and follows the
 * field and the facets, every change of state going through the address.
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
  let latest = 0;
  const show = async (): Promise<void> => {
    const ticket = (latest += 1);
    const outcome = await run(state.query);
    if (ticket !== latest) {
      return;
    }
    if (results !== null) {
      options.render(h(SearchResults, resultsPropsOf(state, outcome, site, navigate)), results);
    } else if (suggestions !== null) {
      const meta = outcome.meta;
      const shown =
        meta === undefined || queryWords(state.query).length === 0
          ? []
          : outcome.hits.slice(0, SUGGESTIONS).map((hit) => resultOf(hit.entry, meta, site));
      options.render(h(ResultList, { results: shown }), suggestions);
      suggestions.hidden = shown.length === 0;
    }
  };
  const navigate = (href: string): void => {
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
    void show();
  });
  if (results !== null) {
    field.value = state.query;
    void show();
  }
  return mounted;
}
