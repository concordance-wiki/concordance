import { h, type JSX } from "preact";

import { activeFiltersOf, countFacets, facetsOf, filterEntries } from "../search/facets.js";
import {
  closestForm,
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
import type {
  ClosestFormProposal,
  SearchField,
  SearchResult,
  SearchResultsProps,
  SuggestionLabels,
} from "../slots.js";
import { SearchResults } from "../theme/default/search-results.js";
import {
  defaultSuggestionLabels,
  SearchSuggestions,
  type Suggestion,
} from "../theme/default/search-suggestions.js";

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
 * whole table for a query without, the most cited first, so that the results page lists the
 * site under the facets alone; the keyword pages come after the entities either way.
 */
export function hitsOf(
  query: string,
  meta: SearchMeta,
  shards: ReadonlyMap<string, ShardData>,
): SearchHit[] {
  const words = queryWords(query);
  const keyword = (entity: number): boolean => meta.entities[entity]?.keyword === true;
  const cited = (entity: number): number => meta.entities[entity]?.cited ?? 0;
  if (words.length === 0) {
    // Every entity scores the same: the most cited first, the table order among equals, the keyword pages after them.
    return meta.entities
      .map((entry, entity) => ({ entry, entity }))
      .sort(
        (a, b) =>
          Number(keyword(a.entity)) - Number(keyword(b.entity)) ||
          cited(b.entity) - cited(a.entity) ||
          a.entity - b.entity,
      )
      .map(({ entry }) => ({ entry, score: 0 }));
  }
  return rank(words, shards, { keyword, cited }).flatMap(({ entity, score }) => {
    const entry = meta.entities[entity];
    return entry === undefined ? [] : [{ entry, score }];
  });
}

/** What the row of a keyword page states: in how many documents it is used, and that no note defines it, worded in the site language. */
export function keywordDetail(entry: SearchEntry, meta: SearchMeta): string {
  return plural(meta.labels.usedIn, entry.documents ?? 0, meta.locale);
}

/** What the row of a note states on the line of its title: how many pages cite it, worded in the site language. */
export function citedDetail(entry: SearchEntry, meta: SearchMeta): string {
  return plural(meta.labels.cited, entry.cited ?? 0, meta.locale);
}

/** The line under the summary of a note: its space, then its other names and its broader term when it declares them. */
export function factsOf(entry: SearchEntry, meta: SearchMeta): string[] {
  const facts = [meta.sources[entry.source] ?? entry.source];
  if (entry.aliases !== undefined && entry.aliases.length > 0) {
    facts.push(meta.labels.alsoCalled.replace("{aliases}", entry.aliases.join(", ")));
  }
  if (entry.broader !== undefined) {
    facts.push(meta.labels.broader.replace("{term}", entry.broader));
  }
  return facts;
}

/** A hit as the lists show it: the type badge, the title, the citations, the summary and the facts, the href from the page through `root`; a keyword page with its documents and its notice. */
export function resultOf(entry: SearchEntry, meta: SearchMeta, root: string): SearchResult {
  const typeLabel = meta.types[entry.type];
  return {
    title: entry.title,
    href: `${root}${entry.url}`,
    ...(typeLabel === undefined ? {} : { typeLabel }),
    ...(entry.keyword === true
      ? { keyword: true, detail: keywordDetail(entry, meta) }
      : {
          cited: citedDetail(entry, meta),
          ...(entry.summary === undefined ? {} : { snippet: entry.summary }),
          facts: factsOf(entry, meta),
        }),
  };
}

/**
 * What the empty state proposes for a query with words that matched nothing: the closest form
 * of the dictionary with its counts, and the search on that form under the same filters.
 */
export function closestOf(state: SearchState, meta: SearchMeta): ClosestFormProposal | undefined {
  const closest = closestForm(state.query, meta.entities);
  const entry = closest === undefined ? undefined : meta.entities[closest.entity];
  if (closest === undefined || entry === undefined) return undefined;
  return {
    form: closest.form,
    href: resultsHref(withQuery(state, closest.form)),
    detail:
      entry.keyword === true
        ? plural(meta.labels.occurrences, entry.occurrences ?? 0, meta.locale)
        : citedDetail(entry, meta),
  };
}

/**
 * A hit as the live results show it: the title, the href from the page through `root`, the
 * space, and what the detail line reads: the documents of a keyword page, the citations of a
 * note of a glossary source, the type and the summary of any other note.
 */
export function suggestionOf(entry: SearchEntry, meta: SearchMeta, root: string): Suggestion {
  const typeLabel = meta.types[entry.type];
  return {
    title: entry.title,
    href: `${root}${entry.url}`,
    ...(typeLabel === undefined ? {} : { typeLabel }),
    ...(entry.keyword === true
      ? { keyword: true, documents: entry.documents ?? 0 }
      : {
          ...(entry.summary === undefined ? {} : { summary: entry.summary }),
          ...(meta.glossary.includes(entry.source) ? { glossary: true } : {}),
          cited: entry.cited ?? 0,
        }),
    space: meta.sources[entry.source] ?? entry.source,
  };
}

/** The folders of an entry under its space, `objects/ingestion` for `specs/objects/ingestion/source`; empty for a page at the root of its space. */
function folderOf(entry: SearchEntry): string {
  return entry.id.split("/").slice(1, -1).join("/");
}

/**
 * The rows of the live results, those sharing a title told apart: by their space when no
 * namesake shares it, by their folder otherwise, the space again for a page at its root.
 */
export function disambiguated(
  rows: readonly { entry: SearchEntry; suggestion: Suggestion }[],
): Suggestion[] {
  return rows.map(({ entry, suggestion }) => {
    const namesakes = rows.filter((row) => row.suggestion.title === suggestion.title);
    if (namesakes.length < 2) return suggestion;
    const sameSpace = namesakes.filter((row) => row.suggestion.space === suggestion.space);
    return {
      ...suggestion,
      qualifier: sameSpace.length === 1 ? suggestion.space : folderOf(entry) || suggestion.space,
    };
  });
}

/**
 * The state a field submits: its query, with the facet values the field carries as hidden fields
 * and, on the field of a space page, the source facet set to that space.
 */
export function fieldState(search: SearchField, query: string): SearchState {
  const state = withQuery(
    parseSearchState(new URLSearchParams(search.filters ?? {}).toString()),
    query,
  );
  return search.source === undefined
    ? state
    : { ...state, filters: { ...state.filters, source: [search.source] } };
}

/** The results page with the query typed: the action of the form, then the query string of that query and of the filters the field submits with it. */
export function seeResultsHref(search: SearchField, query: string): string {
  return `${search.action}${searchQueryString(fieldState(search, query))}`;
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

/** `Escape` in the field leaves it and tells the caller, so that the live results go. */
export function wireEscape(input: SearchInput, onEscape: () => void): void {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.blur();
      onEscape();
    }
  });
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
  wireEscape(input, onEscape);
}

/** An element the keyboard can reach: a link of the live results. */
export interface Focusable {
  focus(): void;
}

/**
 * The arrow keys walk the live results: `ArrowDown` in the field reaches the first row, then
 * moves down the rows, `ArrowUp` moves up and, from the first row, back to the field;
 * `Escape` on a row hides the results and returns to the field. A row is a link, so `Enter`
 * opens it as any link.
 */
export function wireArrows(
  input: SearchInput,
  panel: SearchPanel,
  links: () => readonly Focusable[],
): void {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" || panel.hidden) return;
    const [first] = links();
    if (first === undefined) return;
    event.preventDefault();
    first.focus();
  });
  panel.addEventListener("keydown", (event) => {
    const rows = links();
    const at = rows.findIndex((row) => row === event.target);
    if (at < 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rows[Math.min(at + 1, rows.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (at === 0) {
        input.focus();
      } else {
        rows[at - 1]?.focus();
      }
    } else if (event.key === "Escape") {
      panel.hidden = true;
      input.focus();
    }
  });
}

/** Where a list is drawn: the panel of the live results under a field, or the island of the results page. */
export interface SearchPanel {
  hidden: boolean;
  addEventListener(type: "keydown", listener: (event: KeyEvent) => void): void;
}

/** Where the number of matches is written, next to the field of the home page. */
export interface CounterSlot {
  textContent: string | null;
}

/** The button clearing the field, served hidden and shown while the field holds a query. */
export interface SearchClear {
  hidden: boolean;
  addEventListener(type: "click", listener: () => void): void;
}

export interface SearchIslandElement<P extends SearchPanel> {
  getAttribute(name: string): string | null;
  /** The field of a field island, none on the results island. */
  input(): SearchInput | null;
  /** The button clearing the field of a field island, none on the results island. */
  clear(): SearchClear | null;
  /** The panel of the live results of a field island, none on the results island. */
  panel(): P | null;
  /** The links of the rows the panel shows, in order; none before the island draws them. */
  links(): readonly Focusable[];
  /** The counter of matches of the field of the home page; none on the header field. */
  counter(): CounterSlot | null;
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
  const worded = queryWords(state.query).length > 0;
  const closest = worded && entries.length === 0 ? closestOf(state, meta) : undefined;
  return {
    query: state.query,
    total: kept.length,
    results: kept.map((entry) => resultOf(entry, meta, root)),
    facets: facetsOf(meta, state, countFacets(entries, state), hrefOf),
    summary:
      kept.length > 0
        ? plural(meta.labels.results, kept.length, meta.locale)
        : worded
          ? meta.labels.noResultFor.replace("{query}", state.query)
          : meta.labels.noResult,
    ...(filters.length === 0 ? {} : { active: filters, clearHref: hrefOf(clearFilters(state)) }),
    ...(closest === undefined ? {} : { closest }),
    labels: {
      facets: meta.labels.facets,
      activeFilters: meta.labels.activeFilters,
      removeFilter: meta.labels.removeFilter,
      clear: meta.labels.clear,
      address: meta.labels.address,
      copyAddress: meta.labels.copyAddress,
      copied: meta.labels.copied,
      countersNote: meta.labels.countersNote,
      notelessNote: meta.labels.notelessNote,
      closestForm: meta.labels.closestForm,
    },
    address: resultsAddress(state),
    ...actions,
  };
}

/** A field island once read: its input, its clear button, its panel and counter, and the field it was served with. */
interface Field<P extends SearchPanel> {
  input: SearchInput;
  clear: SearchClear | null;
  panel: P | null;
  counter: CounterSlot | null;
  links: () => readonly Focusable[];
  search: SearchField;
  home: boolean;
  /** What clearing the field does beyond emptying it: runs the empty query, once the site has an index. */
  onClear: () => void;
}

/** The clear button stands while the field holds something to clear. */
function showClear<P extends SearchPanel>(field: Field<P>): void {
  if (field.clear !== null) field.clear.hidden = field.input.value === "";
}

/** The clear button follows what the reader types and, pressed, empties the field, keeps the focus there and runs what the field does on an empty query. */
function wireClear<P extends SearchPanel>(field: Field<P>): void {
  const { input, clear } = field;
  if (clear === null) return;
  input.addEventListener("input", () => {
    showClear(field);
  });
  clear.addEventListener("click", () => {
    input.value = "";
    showClear(field);
    input.focus();
    field.onClear();
  });
}

/**
 * Wires every search island of a page: each field, the one of the header and the one at the
 * head of the home page, gets the `Escape` shortcut, its clear button and, when the site has
 * an index, its live results as the reader types, walked by the arrow keys; `/` reaches the
 * field of the home page when there is one, else the field of the header. The results island,
 * when the page has one, shows the list for the state of the address, filtered by its facets,
 * and follows the field and the facets. Every change of state goes through the address: a facet
 * followed pushes an entry to the history, typing rewrites the current one once the reader
 * pauses, clearing the field rewrites it at once, and going back replays the state of the
 * address, the scroll position included.
 */
export function mountSearch<P extends SearchPanel>(options: SearchIslands<P>): number {
  let root: string | undefined;
  const fields: Field<P>[] = [];
  let results: P | null = null;
  let mounted = 0;
  for (const element of options.islands) {
    // Written by island() at build: the attribute carries the props of the island.
    const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as SearchIslandProps;
    root ??= props.root;
    const input = element.input();
    if (props.search !== undefined && input !== null) {
      fields.push({
        input,
        clear: element.clear(),
        panel: element.panel(),
        counter: element.counter(),
        links: () => element.links(),
        search: props.search,
        home: props.home === true,
        onClear: () => undefined,
      });
    }
    if (props.results !== undefined) {
      results = element.container();
    }
    mounted += 1;
  }
  const primary = fields.find((field) => field.home) ?? fields[0];
  if (primary === undefined) {
    return mounted;
  }
  for (const field of fields) {
    const hide = (): void => {
      if (field.panel !== null) field.panel.hidden = true;
    };
    if (field === primary) {
      wireShortcuts(options.document, field.input, hide);
    } else {
      wireEscape(field.input, hide);
    }
    wireClear(field);
  }
  if (root === undefined) {
    return mounted;
  }
  const site = root;
  const run = searchRunner(site, options.inject, options.host);
  for (const field of fields) {
    if (results === null || field !== primary) {
      suggest(field, run, site, options);
    }
  }
  if (results !== null) {
    follow(primary, results, run, site, options);
  }
  return mounted;
}

/** The live results of a field: drawn under it as the reader types, the matches counted next to it, hidden when nothing matches. */
function suggest<P extends SearchPanel>(
  field: Field<P>,
  run: SearchRunner,
  site: string,
  options: SearchIslands<P>,
): void {
  const labels: SuggestionLabels = field.search.suggestions ?? defaultSuggestionLabels;
  let latest = 0;
  const draw = async (): Promise<void> => {
    const ticket = (latest += 1);
    const query = field.input.value;
    const answer = await run(query);
    if (ticket !== latest) {
      return;
    }
    const meta = answer.meta;
    // The field of a space page keeps its live results to the space.
    const hits = filterEntries(answer.hits, (hit) => hit.entry, fieldState(field.search, query));
    const shown =
      meta === undefined || queryWords(query).length === 0
        ? []
        : disambiguated(
            hits.slice(0, SUGGESTIONS).map((hit) => ({
              entry: hit.entry,
              suggestion: suggestionOf(hit.entry, meta, site),
            })),
          );
    const total = shown.length === 0 ? 0 : hits.length;
    const locale = meta?.locale ?? "en";
    if (field.panel !== null) {
      options.render(
        h(SearchSuggestions, {
          query,
          suggestions: shown,
          total,
          resultsHref: seeResultsHref(field.search, query),
          locale,
          labels,
        }),
        field.panel,
      );
      field.panel.hidden = shown.length === 0;
    }
    if (field.counter !== null) {
      field.counter.textContent = total === 0 ? "" : plural(labels.matches, total, locale);
    }
  };
  field.input.addEventListener("focus", () => {
    void run("");
  });
  field.input.addEventListener("input", () => {
    void draw();
  });
  field.onClear = (): void => {
    void draw();
  };
  if (field.panel !== null) {
    wireArrows(field.input, field.panel, field.links);
  }
}

/** The results page: its list follows the field and the address, and the address follows the field. */
function follow<P extends SearchPanel>(
  field: Field<P>,
  results: P,
  run: SearchRunner,
  site: string,
  options: SearchIslands<P>,
): void {
  const input = field.input;
  let state = parseSearchState(options.location.search());
  let copied = false;
  let latest = 0;
  let cancelReplace: (() => void) | undefined;
  const draw = (answer: SearchOutcome): void => {
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
                  draw(answer);
                },
                () => undefined,
              );
            },
          };
    options.render(h(SearchResults, resultsPropsOf(state, answer, site, actions)), results);
  };
  const show = async (restoreScroll = false): Promise<void> => {
    const ticket = (latest += 1);
    const answer = await run(state.query);
    if (ticket !== latest) {
      return;
    }
    copied = false;
    draw(answer);
    const position = restoreScroll
      ? options.scroll.remembered(searchQueryString(state))
      : undefined;
    if (position !== undefined) options.scroll.scrollTo(position);
  };
  const navigate = (href: string): void => {
    cancelReplace?.();
    state = parseSearchState(href);
    input.value = state.query;
    showClear(field);
    options.location.push(searchQueryString(state));
    void show();
  };
  input.addEventListener("input", () => {
    state = withQuery(state, input.value);
    cancelReplace?.();
    cancelReplace = options.defer(() => {
      options.location.replace(searchQueryString(state));
    }, REPLACE_DELAY);
    void show();
  });
  field.onClear = (): void => {
    cancelReplace?.();
    state = withQuery(state, "");
    options.location.replace(searchQueryString(state));
    void show();
  };
  input.value = state.query;
  showClear(field);
  options.location.onPop(() => {
    cancelReplace?.();
    state = parseSearchState(options.location.search());
    input.value = state.query;
    showClear(field);
    void show(true);
  });
  options.scroll.onScroll(() => {
    options.scroll.remember(searchQueryString(state), options.scroll.position());
  });
  void show(true);
}
