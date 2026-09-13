import { h, type JSX } from "preact";

import {
  queryWords,
  rank,
  SEARCH_DIRECTORY,
  SEARCH_META,
  shardHref,
  shardOf,
  type SearchIslandProps,
  type SearchMeta,
  type ShardData,
} from "../search/shared.js";
import type { SearchResult } from "../slots.js";
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

export interface SearchOutcome {
  query: string;
  /** Every match, best first, as the results page shows them. */
  results: SearchResult[];
}

/** Runs a query against the index of a site: the entity table once, then one shard per word. */
export type SearchRunner = (query: string) => Promise<SearchOutcome>;

/** The results of a query over the loaded files, hrefs relative to the page through `root`. */
export function outcomeOf(
  query: string,
  meta: SearchMeta,
  shards: ReadonlyMap<string, ShardData>,
  root: string,
): SearchOutcome {
  const results = rank(queryWords(query), shards).flatMap(({ entity }) => {
    const entry = meta.entities[entity];
    if (entry === undefined) {
      return [];
    }
    const breadcrumb = [
      entry.application === undefined ? undefined : meta.applications[entry.application],
      entry.domain === undefined ? undefined : meta.domains[entry.domain],
    ].filter((part) => part !== undefined);
    const typeLabel = meta.types[entry.type];
    return [
      {
        title: entry.title,
        href: `${root}${entry.url}`,
        ...(typeLabel === undefined ? {} : { typeLabel }),
        ...(breadcrumb.length === 0 ? {} : { breadcrumb }),
      },
    ];
  });
  return { query, results };
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
      return { query, results: [] };
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
    return outcomeOf(query, meta, shards, root);
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

export interface SearchIslands<P extends SearchPanel> {
  islands: Iterable<SearchIslandElement<P>>;
  document: SearchDocument;
  /** The `q` parameter of the page address, empty when absent. */
  initialQuery: string;
  inject: ScriptInjector;
  host: ShardHost;
  render(vnode: JSX.Element, container: P): void;
}

/**
 * Wires every search island of a page: the field of the header gets the shortcuts and, when the
 * site has an index, suggestions as the reader types; the results island, when the page has
 * one, shows the full list for the query of the address and follows the field.
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
  const run = searchRunner(root, options.inject, options.host);
  let latest = 0;
  const show = async (query: string): Promise<void> => {
    const ticket = (latest += 1);
    const outcome = await run(query);
    if (ticket !== latest) {
      return;
    }
    if (results !== null) {
      options.render(
        h(SearchResults, {
          query: outcome.query,
          total: outcome.results.length,
          results: outcome.results,
          facets: [],
        }),
        results,
      );
    } else if (suggestions !== null) {
      options.render(
        h(ResultList, { results: outcome.results.slice(0, SUGGESTIONS) }),
        suggestions,
      );
      suggestions.hidden = outcome.results.length === 0;
    }
  };
  field.addEventListener("focus", () => {
    void run("");
  });
  field.addEventListener("input", () => {
    void show(field.value);
  });
  if (results !== null && options.initialQuery !== "") {
    field.value = options.initialQuery;
    void show(options.initialQuery);
  }
  return mounted;
}
