import type { JSX } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import {
  citedDetail,
  closestOf,
  emptyOf,
  emptySummary,
  resultsHref,
  disambiguated,
  factsOf,
  hitsOf,
  isEditable,
  keywordDetail,
  mountSearch,
  REPLACE_DELAY,
  resultOf,
  RESULTS_BATCH,
  resultsPropsOf,
  SCROLL_KEY,
  scrollMemory,
  searchRunner,
  fieldState,
  seeResultsHref,
  shardLoader,
  storageOf,
  suggestionOf,
  SUGGESTIONS,
  wireArrows,
  wireShortcuts,
  type CounterSlot,
  type Focusable,
  type KeyEvent,
  type ScriptInjector,
  type SearchClear,
  type SearchInput,
  type SearchIslandElement,
  type Defer,
  type ScrollMemory,
  type SearchIslands,
  type SearchLocation,
  type SearchPanel,
  type ShardHost,
} from "../../src/islands/search.js";
import { activeFiltersOf } from "../../src/search/facets.js";
import type { SearchEntry, SearchMeta, ShardData } from "../../src/search/shared.js";
import type { Suggestion } from "../../src/theme/default/search-suggestions.js";
import { parseSearchState } from "../../src/search/state.js";
import type { SearchResultsProps } from "../../src/slots.js";
import { searchLabels } from "../helpers/search.js";

/** The index of a small site, as the build writes it. */
const meta: SearchMeta = {
  entities: [
    {
      id: "glossary/keyword-page",
      title: "Keyword page",
      type: "term",
      url: "glossary/keyword-page/index.html",
      application: "concordance-cli",
      domain: "publication",
      status: "active",
      source: "glossary",
      summary: "The page built for a word above the threshold.",
      aliases: ["word page"],
      broader: "Page",
      cited: 4,
    },
    {
      id: "specs/screens/search-results",
      title: "Search results",
      type: "screen",
      url: "specs/screens/search-results/index.html",
      application: "concordance-cli",
      status: "active",
      source: "specs",
      cited: 1,
    },
    {
      id: "keywords/build-summary",
      title: "build summary",
      type: "keyword",
      url: "keywords/build-summary/index.html",
      status: "valid",
      source: "specs",
      keyword: true,
      occurrences: 17,
      documents: 6,
    },
  ],
  shards: ["ke", "pa", "se"],
  types: { keyword: "Keyword", term: "Term" },
  applications: { "concordance-cli": "Command line" },
  domains: { publication: "Publication" },
  sources: { glossary: "glossary", specs: "specs" },
  glossary: ["glossary"],
  counts: {
    type: { keyword: 1, term: 1 },
    source: { glossary: 1, specs: 2 },
    domain: { publication: 1 },
    application: { "concordance-cli": 2 },
    nonote: { only: 1, exclude: 2 },
  },
  labels: searchLabels,
  locale: "en",
  bytes: 120,
};

const shards: Record<string, ShardData> = {
  ke: { keyword: [[0, 5]], keywords: [[2, 1]] },
  pa: { page: [[0, 5]] },
  se: { search: [[1, 5]], seuil: [[0, 1]] },
};

interface Injected {
  src: string;
  done: (loaded: boolean) => void;
}

/** A page that receives the scripts and answers them like the files of the build would. */
function page(): {
  host: ShardHost;
  inject: ScriptInjector;
  injected: Injected[];
  answer: (name: string, data?: unknown) => void;
} {
  const host: ShardHost = {};
  const injected: Injected[] = [];
  return {
    host,
    injected,
    inject: (src, done) => {
      injected.push({ src, done });
    },
    answer: (name, data) => {
      const script = injected.find((candidate) => candidate.src.endsWith(`/${name}.js`));
      if (script === undefined) throw new Error(`${name} was not requested`);
      if (data === undefined) {
        script.done(false);
        return;
      }
      host.__concordanceSearch?.shard(name, data);
      script.done(true);
    },
  };
}

describe("Search works over file://", () => {
  it("loads a shard by injecting a classic script under search/ and resolves with what the script calls back", async () => {
    const { host, inject, injected, answer } = page();
    const load = shardLoader("../search/", inject, host);
    const loading = load("ke");
    expect(injected.map((script) => script.src)).toEqual(["../search/ke.js"]);
    expect(host.__concordanceSearch).toBeDefined();
    answer("ke", shards["ke"]);
    expect(await loading).toEqual(shards["ke"]);
  });

  it("requests a shard once whatever the number of callers, and encodes a name that is not a plain word", async () => {
    const { host, inject, injected, answer } = page();
    const load = shardLoader("search/", inject, host);
    const first = load("ke");
    const second = load("ke");
    void load("l'");
    expect(injected.map((script) => script.src)).toEqual(["search/ke.js", "search/l_0027.js"]);
    answer("ke", shards["ke"]);
    expect(await first).toBe(await second);
  });

  it("lets two loaders of one page share the global, each hearing the files it asked for", async () => {
    const { host, inject, answer } = page();
    const first = shardLoader("search/", inject, host);
    const second = shardLoader("search/", inject, host);
    const fromFirst = first("ke");
    const fromSecond = second("pa");
    answer("ke", shards["ke"]);
    answer("pa", shards["pa"]);
    expect(await fromFirst).toEqual(shards["ke"]);
    expect(await fromSecond).toEqual(shards["pa"]);
  });

  it("resolves to nothing when the script fails to load, and ignores a callback nothing waits for", async () => {
    const { host, inject, answer } = page();
    const load = shardLoader("search/", inject, host);
    const loading = load("zz");
    answer("zz");
    expect(await loading).toBeUndefined();
    expect(() => {
      host.__concordanceSearch?.shard("never", {});
    }).not.toThrow();
  });
});

describe("hitsOf and resultOf", () => {
  it("turns the ranked entities into results with the type chip, the title, the citations, the summary, the facts and the href from the page", () => {
    const loaded = new Map(Object.entries(shards));
    const hits = hitsOf("key", meta, loaded);
    expect(hits.map((hit) => [hit.entry.id, hit.score])).toEqual([
      ["glossary/keyword-page", 5],
      ["keywords/build-summary", 1],
    ]);
    expect(hits.map((hit) => resultOf(hit.entry, meta, "../"))).toEqual([
      {
        title: "Keyword page",
        href: "../glossary/keyword-page/index.html",
        typeLabel: "Term",
        cited: "cited in 4 pages",
        citedCount: 4,
        snippet: "The page built for a word above the threshold.",
        facts: ["glossary", "Also called: word page", "Broader term: Page"],
      },
      {
        title: "build summary",
        href: "../keywords/build-summary/index.html",
        typeLabel: "Keyword",
        keyword: true,
        detail: "Used in 6 documents, never defined in the glossary",
      },
    ]);
    expect(hitsOf("search", meta, loaded).map((hit) => resultOf(hit.entry, meta, ""))).toEqual([
      {
        title: "Search results",
        href: "specs/screens/search-results/index.html",
        cited: "cited in 1 page",
        citedCount: 1,
        facts: ["specs"],
      },
    ]);
    const unlabelled: SearchMeta = { ...meta, sources: {} };
    const elsewhere: SearchEntry = {
      id: "elsewhere/note",
      title: "Note",
      type: "screen",
      url: "elsewhere/note/index.html",
      status: "active",
      source: "elsewhere",
    };
    expect(factsOf(elsewhere, unlabelled)).toEqual(["elsewhere"]);
    expect(factsOf({ ...elsewhere, aliases: [] }, unlabelled)).toEqual(["elsewhere"]);
    expect(citedDetail(elsewhere, meta)).toBe("cited in 0 pages");
    // A page nothing cites carries no count at all: neither worded nor bare.
    expect(resultOf(elsewhere, meta, "")).toEqual({
      title: "Note",
      href: "elsewhere/note/index.html",
      facts: ["elsewhere"],
    });
  });

  it("lists the whole table, scored 0, for a query without a word, the most cited first, so that the facets alone browse the site", () => {
    expect(hitsOf("", meta, new Map()).map((hit) => [hit.entry.id, hit.score])).toEqual([
      ["glossary/keyword-page", 0],
      ["specs/screens/search-results", 0],
      ["keywords/build-summary", 0],
    ]);
    expect(hitsOf(" a ", meta, new Map())).toHaveLength(3);
    const reversed: SearchMeta = {
      ...meta,
      entities: [meta.entities[2], meta.entities[1], meta.entities[0]].filter(
        (entry): entry is SearchEntry => entry !== undefined,
      ),
    };
    expect(hitsOf("", reversed, new Map()).map((hit) => hit.entry.id)).toEqual([
      "glossary/keyword-page",
      "specs/screens/search-results",
      "keywords/build-summary",
    ]);
    const uncited: SearchMeta = {
      ...meta,
      entities: meta.entities.map((entry) => {
        const { cited, ...rest } = entry;
        expect(cited === undefined || cited >= 0).toBe(true);
        return rest;
      }),
    };
    expect(hitsOf("", uncited, new Map()).map((hit) => hit.entry.id)).toEqual([
      "glossary/keyword-page",
      "specs/screens/search-results",
      "keywords/build-summary",
    ]);
  });

  it("leaves out an entity index the table does not have", () => {
    const loaded = new Map<string, ShardData>([["zz", { zzz: [[9, 5]] }]]);
    expect(hitsOf("zzz", meta, loaded)).toEqual([]);
  });
});

describe("searchRunner: the index is loaded in pieces as the user types", () => {
  it("loads the entity table once on the first query, then one shard per word, never twice", async () => {
    const { host, inject, injected, answer } = page();
    const run = searchRunner("../", inject, host);
    const warming = run("");
    expect(injected.map((script) => script.src)).toEqual(["../search/meta.js"]);
    answer("meta", meta);
    expect((await warming).hits).toHaveLength(3);
    expect((await warming).meta).toBe(meta);
    const first = run("Key");
    await Promise.resolve();
    expect(injected.map((script) => script.src)).toEqual(["../search/meta.js", "../search/ke.js"]);
    answer("ke", shards["ke"]);
    expect((await first).hits.map((hit) => hit.entry.title)).toEqual([
      "Keyword page",
      "build summary",
    ]);
    const second = run("keyword page");
    await Promise.resolve();
    expect(injected.map((script) => script.src)).toEqual([
      "../search/meta.js",
      "../search/ke.js",
      "../search/pa.js",
    ]);
    answer("pa", shards["pa"]);
    expect((await second).hits.map((hit) => hit.entry.title)).toEqual(["Keyword page"]);
    const again = await run("keyword page");
    expect(again.hits).toHaveLength(1);
    expect(injected).toHaveLength(3);
  });

  it("asks nothing for a word whose shard the table does not list, and matches nothing", async () => {
    const { host, inject, injected, answer } = page();
    const run = searchRunner("", inject, host);
    const running = run("zebra");
    answer("meta", meta);
    expect((await running).hits).toEqual([]);
    expect(injected.map((script) => script.src)).toEqual(["search/meta.js"]);
  });

  it("treats a shard that fails to load as empty, and a table that fails as no index at all", async () => {
    const { host, inject, answer } = page();
    const run = searchRunner("", inject, host);
    const running = run("key");
    answer("meta", meta);
    await Promise.resolve();
    answer("ke");
    expect((await running).hits).toEqual([]);
    const other = page();
    const failing = searchRunner("", other.inject, other.host)("key");
    other.answer("meta");
    expect(await failing).toEqual({ query: "key", hits: [] });
  });
});

function keyEvent(
  key: string,
  overrides: Partial<KeyEvent> = {},
): KeyEvent & { prevented: boolean } {
  const event = {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: null,
    prevented: false,
    preventDefault() {
      event.prevented = true;
    },
    ...overrides,
  };
  return event;
}

interface FakeInput extends SearchInput {
  focused: boolean;
  listeners: Record<string, ((event: KeyEvent) => void)[]>;
  fire(type: "input" | "focus" | "keydown", event?: KeyEvent): void;
}

function fakeInput(): FakeInput {
  const input: FakeInput = {
    value: "",
    focused: false,
    listeners: {},
    focus() {
      input.focused = true;
    },
    blur() {
      input.focused = false;
    },
    addEventListener(type: string, listener: (event: KeyEvent) => void) {
      (input.listeners[type] ??= []).push(listener);
    },
    fire(type, event = keyEvent("")) {
      for (const listener of input.listeners[type] ?? []) listener(event);
    },
  };
  return input;
}

function fakeDocument(): {
  addEventListener(type: "keydown", listener: (event: KeyEvent) => void): void;
  press(event: KeyEvent): void;
} {
  const listeners: ((event: KeyEvent) => void)[] = [];
  return {
    addEventListener: (_type, listener) => {
      listeners.push(listener);
    },
    press: (event) => {
      for (const listener of listeners) listener(event);
    },
  };
}

describe("Keyboard shortcut / reaches the field, Escape leaves it", () => {
  it("focuses the field on / pressed outside a text control, and swallows the character", () => {
    const document = fakeDocument();
    const input = fakeInput();
    wireShortcuts(document, input);
    const slash = keyEvent("/", { target: { tagName: "BODY" } });
    document.press(slash);
    expect(input.focused).toBe(true);
    expect(slash.prevented).toBe(true);
  });

  it("leaves / alone with a modifier, in an input, a textarea, a select or an editable element", () => {
    const document = fakeDocument();
    const input = fakeInput();
    wireShortcuts(document, input);
    for (const event of [
      keyEvent("/", { ctrlKey: true }),
      keyEvent("/", { altKey: true }),
      keyEvent("/", { metaKey: true }),
      keyEvent("?"),
      keyEvent("/", { target: { tagName: "input" } }),
      keyEvent("/", { target: { tagName: "TEXTAREA" } }),
      keyEvent("/", { target: { tagName: "SELECT" } }),
      keyEvent("/", { target: { tagName: "DIV", isContentEditable: true } }),
    ]) {
      document.press(event);
      expect(input.focused).toBe(false);
      expect(event.prevented).toBe(false);
    }
    expect(isEditable(null)).toBe(false);
    expect(isEditable("text")).toBe(false);
    expect(isEditable({})).toBe(false);
    expect(isEditable({ tagName: 3 })).toBe(false);
  });

  it("blurs the field on Escape and tells the caller, and ignores any other key in the field", () => {
    const document = fakeDocument();
    const input = fakeInput();
    let escaped = 0;
    wireShortcuts(document, input, () => {
      escaped += 1;
    });
    input.focus();
    input.fire("keydown", keyEvent("a"));
    expect(input.focused).toBe(true);
    input.fire("keydown", keyEvent("Escape"));
    expect(input.focused).toBe(false);
    expect(escaped).toBe(1);
    const plain = fakeInput();
    wireShortcuts(fakeDocument(), plain);
    expect(() => {
      plain.fire("keydown", keyEvent("Escape"));
    }).not.toThrow();
  });
});

interface Panel extends SearchPanel {
  html: string;
  /** Fires a key event on the panel, as a keystroke on one of its links would. */
  press(event: KeyEvent): void;
}

function fakePanel(hidden: boolean): Panel {
  const listeners: ((event: KeyEvent) => void)[] = [];
  return {
    hidden,
    html: "",
    addEventListener: (_type, listener) => {
      listeners.push(listener);
    },
    press: (event) => {
      for (const listener of listeners) listener(event);
    },
  };
}

/** A link of the live results the arrow keys can reach. */
interface FakeLink extends Focusable {
  focused: boolean;
}

function fakeLink(): FakeLink {
  const link: FakeLink = {
    focused: false,
    focus: () => {
      link.focused = true;
    },
  };
  return link;
}

interface FakeClear extends SearchClear {
  clicks: (() => void)[];
  click(): void;
}

function fakeClear(): FakeClear {
  const clear: FakeClear = {
    hidden: true,
    clicks: [],
    addEventListener(_type, listener) {
      clear.clicks.push(listener);
    },
    click() {
      for (const listener of clear.clicks) listener();
    },
  };
  return clear;
}

function island(
  props: Record<string, unknown>,
  parts: {
    input?: FakeInput;
    clear?: FakeClear;
    panel?: Panel;
    container: Panel;
    links?: () => FakeLink[];
    counter?: CounterSlot;
  },
): SearchIslandElement<Panel> {
  return {
    getAttribute: (name) => (name === "data-props" ? JSON.stringify(props) : null),
    input: () => parts.input ?? null,
    clear: () => parts.clear ?? null,
    panel: () => parts.panel ?? null,
    links: () => parts.links?.() ?? [],
    counter: () => parts.counter ?? null,
    container: () => parts.container,
  };
}

interface Rendered {
  render: SearchIslands<Panel>["render"];
  calls: number;
  /** The props of the last results view drawn, so that a test follows a facet as a click would. */
  props(): SearchResultsProps;
}

function rendered(): Rendered {
  let last: JSX.Element | undefined;
  const state: Rendered = {
    calls: 0,
    render: (vnode: JSX.Element, container: Panel) => {
      state.calls += 1;
      last = vnode;
      container.html = renderToString(vnode);
    },
    // Every results view is drawn from these props, which the island builds.
    props: () => (last?.props ?? {}) as SearchResultsProps,
  };
  return state;
}

const settled = async (): Promise<void> => {
  for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
};

interface FakeLocation extends SearchLocation {
  /** The query strings pushed, in order. */
  pushed: string[];
  /** The query strings the current entry was rewritten with, in order. */
  replaced: string[];
  current: string;
  /** Goes back to a query string, as the browser does on the back button. */
  pop(search: string): void;
}

function fakeLocation(search = ""): FakeLocation {
  const listeners: (() => void)[] = [];
  const location: FakeLocation = {
    current: search,
    pushed: [],
    replaced: [],
    search: () => location.current,
    push: (next) => {
      location.current = next;
      location.pushed.push(next);
    },
    replace: (next) => {
      location.current = next;
      location.replaced.push(next);
    },
    onPop: (listener) => {
      listeners.push(listener);
    },
    pop: (next) => {
      location.current = next;
      for (const listener of listeners) listener();
    },
  };
  return location;
}

interface FakeScroll extends ScrollMemory {
  /** The position by query string, as the storage would keep it. */
  stored: Record<string, number>;
  scrolledTo: number[];
  /** The position of the view, which a test moves before it fires a scroll event. */
  at: number;
  fire(): void;
}

function fakeScroll(stored: Record<string, number> = {}): FakeScroll {
  const listeners: (() => void)[] = [];
  const scroll: FakeScroll = {
    stored,
    scrolledTo: [],
    at: 0,
    remembered: (search) => scroll.stored[search],
    remember: (search, position) => {
      scroll.stored[search] = position;
    },
    position: () => scroll.at,
    scrollTo: (position) => {
      scroll.scrolledTo.push(position);
    },
    onScroll: (listener) => {
      listeners.push(listener);
    },
    fire: () => {
      for (const listener of listeners) listener();
    },
  };
  return scroll;
}

interface FakeDefer {
  defer: Defer;
  /** The callbacks waiting, with their delays; `flush` runs and drops them. */
  pending: { callback: () => void; delay: number }[];
  cancelled: number;
  flush(): void;
}

function fakeDefer(): FakeDefer {
  const timers: FakeDefer = {
    pending: [],
    cancelled: 0,
    defer: (callback, delay) => {
      const entry = { callback, delay };
      timers.pending.push(entry);
      return () => {
        if (timers.pending.includes(entry)) {
          timers.cancelled += 1;
          timers.pending = timers.pending.filter((candidate) => candidate !== entry);
        }
      };
    },
    flush: () => {
      const due = timers.pending;
      timers.pending = [];
      for (const { callback } of due) callback();
    },
  };
  return timers;
}

describe("mountSearch", () => {
  it("shows the best results under the header field as the reader types, the query marked in their titles, at most eight, and hides them when nothing matches", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel = fakePanel(true);
    const { render } = rendered();
    const mounted = mountSearch({
      islands: [
        island(
          { root: "../", search: { action: "../search/index.html", placeholder: "Search" } },
          { input, panel, container: panel },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    expect(mounted).toBe(1);
    input.fire("focus");
    answer("meta", meta);
    input.value = "key";
    input.fire("input");
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(panel.hidden).toBe(false);
    expect(panel.html).toBe(
      '<ol class="suggestions"><li class="suggestion"><a href="../glossary/keyword-page/index.html"><span class="suggestion-title"><mark>Key</mark>word page</span><span class="suggestion-detail">Glossary term — cited in 4 pages</span><span class="suggestion-space">glossary</span></a></li><li class="suggestion suggestion-keyword"><a href="../keywords/build-summary/index.html"><span class="suggestion-title">build summary</span><span class="suggestion-detail">Used in 6 documents, never defined</span><span class="suggestion-space">specs</span></a></li></ol><p class="suggestions-help"><kbd>↑ ↓</kbd> browse <kbd>Enter</kbd> open<a class="suggestions-all" href="../search/index.html?q=key">See the 2 results</a></p>',
    );
    input.value = "zebra";
    input.fire("input");
    await settled();
    expect(panel.hidden).toBe(true);
    expect(panel.html).toContain('<ol class="suggestions"></ol>');
    expect(panel.html).toContain(
      '<a class="suggestions-all" href="../search/index.html?q=zebra">See the 0 results</a>',
    );
    input.fire("keydown", keyEvent("Escape"));
    expect(panel.hidden).toBe(true);
    expect(SUGGESTIONS).toBe(8);
  });

  it("keeps the live results of the field of a space page to that space, the link to the results page carrying the source facet", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel = fakePanel(true);
    const { render } = rendered();
    mountSearch({
      islands: [
        island(
          {
            root: "../",
            search: { action: "../search/index.html", placeholder: "Search", source: "specs" },
          },
          { input, panel, container: panel },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    input.fire("focus");
    answer("meta", meta);
    input.value = "key";
    input.fire("input");
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(panel.hidden).toBe(false);
    expect(panel.html).toBe(
      '<ol class="suggestions"><li class="suggestion suggestion-keyword"><a href="../keywords/build-summary/index.html"><span class="suggestion-title">build summary</span><span class="suggestion-detail">Used in 6 documents, never defined</span><span class="suggestion-space">specs</span></a></li></ol><p class="suggestions-help"><kbd>↑ ↓</kbd> browse <kbd>Enter</kbd> open<a class="suggestions-all" href="../search/index.html?q=key&amp;source=specs">See the 1 result</a></p>',
    );
  });

  it("counts the matches next to the field of the home page, words the rows with the labels the field carries, and reaches that field with the / shortcut before the field of the header", async () => {
    const { host, inject, answer } = page();
    const headerInput = fakeInput();
    const headerPanel = fakePanel(true);
    const input = fakeInput();
    const panel = fakePanel(true);
    const counter: CounterSlot = { textContent: "" };
    const document = fakeDocument();
    const { render } = rendered();
    const field = {
      action: "search/index.html",
      placeholder: "",
      suggestions: {
        matches: { one: "# correspondance", other: "# correspondances" },
        usedIn: { one: "Employé dans # document", other: "Employé dans # documents" },
        typeSummary: "{type} — {summary}",
        glossaryTerm: {
          one: "Terme du glossaire — cité dans # page",
          other: "Terme du glossaire — cité dans # pages",
        },
        browse: "parcourir",
        enter: "Entrée",
        open: "ouvrir",
        seeResults: { one: "Voir le résultat", other: "Voir les # résultats" },
      },
    };
    expect(
      mountSearch({
        islands: [
          island(
            { root: "", search: { action: "search/index.html", placeholder: "" } },
            { input: headerInput, panel: headerPanel, container: headerPanel },
          ),
          island(
            { root: "", search: field, home: true },
            { input, panel, container: panel, counter },
          ),
        ],
        document,
        location: fakeLocation(),
        scroll: fakeScroll(),
        defer: fakeDefer().defer,
        inject,
        host,
        render,
      }),
    ).toBe(2);
    document.press(keyEvent("/"));
    expect(input.focused).toBe(true);
    expect(headerInput.focused).toBe(false);
    input.value = "key";
    input.fire("input");
    await settled();
    answer("meta", meta);
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(panel.hidden).toBe(false);
    expect(counter.textContent).toBe("2 correspondances");
    expect(panel.html).toContain('<span class="suggestion-detail">Employé dans 6 documents</span>');
    expect(panel.html).toContain(
      '<span class="suggestion-detail">Terme du glossaire — cité dans 4 pages</span>',
    );
    expect(panel.html).toContain(
      '<p class="suggestions-help"><kbd>↑ ↓</kbd> parcourir <kbd>Entrée</kbd> ouvrir<a class="suggestions-all" href="search/index.html?q=key">Voir les 2 résultats</a></p>',
    );
    // The field of the header has live results of its own, and its Escape hides them alone.
    headerInput.value = "page";
    headerInput.fire("input");
    await settled();
    answer("pa", shards["pa"]);
    await settled();
    expect(headerPanel.hidden).toBe(false);
    expect(headerPanel.html).toContain("Keyword <mark>page</mark>");
    expect(headerPanel.html).toContain("See the 1 result");
    headerInput.focus();
    headerInput.fire("keydown", keyEvent("Escape"));
    expect(headerPanel.hidden).toBe(true);
    expect(headerInput.focused).toBe(false);
    expect(panel.hidden).toBe(false);
    // A query too short for a shard matches nothing: the counter clears.
    input.value = "k";
    input.fire("input");
    await settled();
    expect(panel.hidden).toBe(true);
    expect(counter.textContent).toBe("");
  });

  it("keeps the live results of the latest query when an earlier one answers later", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel = fakePanel(true);
    const view = rendered();
    mountSearch({
      islands: [
        island(
          { root: "", search: { action: "search/", placeholder: "" } },
          { input, panel, container: panel },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render: view.render,
    });
    input.value = "key";
    input.fire("input");
    await settled();
    answer("meta", meta);
    await settled();
    input.value = "page";
    input.fire("input");
    await settled();
    answer("pa", shards["pa"]);
    await settled();
    expect(panel.html).toContain("Keyword <mark>page</mark>");
    expect(panel.html).toContain("See the 1 result");
    const drawn = view.calls;
    answer("ke", shards["ke"]);
    await settled();
    expect(view.calls).toBe(drawn);
    expect(panel.html).toContain("See the 1 result");
  });

  it("caps the suggestions at eight while the results page shows them all", async () => {
    const many: SearchMeta = {
      ...meta,
      entities: Array.from({ length: 12 }, (_, at) => ({
        id: `glossary/term-${String(at)}`,
        title: `Term ${String(at)}`,
        type: "term",
        url: `glossary/term-${String(at)}/index.html`,
        status: "active",
        source: "glossary",
      })),
      shards: ["te"],
    };
    const shard: ShardData = { term: many.entities.map((_, at) => [at, 5]) };
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel = fakePanel(true);
    const { render } = rendered();
    mountSearch({
      islands: [
        island(
          { root: "", search: { action: "", placeholder: "" } },
          { input, panel, container: panel },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    input.value = "term";
    input.fire("input");
    await settled();
    answer("meta", many);
    await settled();
    answer("te", shard);
    await settled();
    expect(panel.html.match(/<li class="suggestion">/g)).toHaveLength(8);
    expect(panel.html).toContain("See the 12 results");
  });

  it("fills the results page from the query of the address and follows the field, the suggestions staying hidden", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel = fakePanel(true);
    const results = fakePanel(false);
    const { render } = rendered();
    const mounted = mountSearch({
      islands: [
        island(
          { root: "../", search: { action: "index.html", placeholder: "Search" } },
          { input, panel, container: panel },
        ),
        island(
          { root: "../", results: { query: "", total: 0, results: [], facets: [] } },
          { container: results },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation("?q=keyword+page"),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    expect(mounted).toBe(2);
    expect(input.value).toBe("keyword page");
    answer("meta", meta);
    await settled();
    answer("ke", shards["ke"]);
    answer("pa", shards["pa"]);
    await settled();
    expect(results.html).toContain(
      '<div class="search-results"><h1 class="visually-hidden">Search</h1>',
    );
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain(
      '<a class="result-title" href="../glossary/keyword-page/index.html">Keyword page</a>',
    );
    expect(panel.html).toBe("");
    expect(panel.hidden).toBe(true);
    input.value = "search";
    input.fire("input");
    await settled();
    answer("se", shards["se"]);
    await settled();
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("Search results");
    expect(results.html).not.toContain("Keyword page");
    input.value = "zebra";
    input.fire("input");
    await settled();
    expect(results.html).toContain(
      '<p class="results-empty-lead" role="status">No result for “zebra”</p><p class="results-empty-cause">No file uses this word.</p>',
    );
    expect(results.html).toContain(
      '<p class="results-empty-note">The search matches the start of words: a typo gives zero results and no suggestion.</p>',
    );
  });

  it("keeps the latest query when an earlier one answers later", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const results = fakePanel(false);
    const { render } = rendered();
    mountSearch({
      islands: [
        island(
          { root: "", search: { action: "", placeholder: "" } },
          { input, container: results },
        ),
        island(
          { root: "", results: { query: "", total: 0, results: [], facets: [] } },
          { container: results },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    input.value = "key";
    input.fire("input");
    await settled();
    input.value = "search";
    input.fire("input");
    await settled();
    answer("meta", meta);
    await settled();
    answer("se", shards["se"]);
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain("Search results");
    expect(results.html).not.toContain("Keyword page");
  });

  it("wires the shortcuts and the clear button alone for a field without an index, and does nothing for a page without a field", () => {
    const { host, inject, injected } = page();
    const input = fakeInput();
    const clear = fakeClear();
    const document = fakeDocument();
    const { render, calls } = rendered();
    const mounted = mountSearch({
      islands: [
        island(
          { search: { action: "search/", placeholder: "" } },
          { input, clear, container: fakePanel(false) },
        ),
      ],
      document,
      location: fakeLocation("?q=key"),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    expect(mounted).toBe(1);
    document.press(keyEvent("/"));
    expect(input.focused).toBe(true);
    input.fire("focus");
    input.value = "key";
    input.fire("input");
    expect(clear.hidden).toBe(false);
    input.blur();
    clear.click();
    expect(input.value).toBe("");
    expect(clear.hidden).toBe(true);
    expect(input.focused).toBe(true);
    expect(injected).toEqual([]);
    expect(calls).toBe(0);
    const results = fakePanel(false);
    expect(
      mountSearch({
        islands: [
          island(
            { root: "", results: { query: "", total: 0, results: [], facets: [] } },
            { container: results },
          ),
        ],
        document: fakeDocument(),
        location: fakeLocation("?q=key"),
        scroll: fakeScroll(),
        defer: fakeDefer().defer,
        inject,
        host,
        render,
      }),
    ).toBe(1);
    expect(
      mountSearch({
        islands: [],
        document,
        location: fakeLocation(),
        scroll: fakeScroll(),
        defer: fakeDefer().defer,
        inject,
        host,
        render,
      }),
    ).toBe(0);
    expect(results.html).toBe("");
  });

  it("hides the suggestions when the table fails to load", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel = fakePanel(true);
    mountSearch({
      islands: [
        island(
          { root: "", search: { action: "", placeholder: "" } },
          { input, panel, container: panel },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render: rendered().render,
    });
    input.value = "key";
    input.fire("input");
    await settled();
    answer("meta");
    await settled();
    expect(panel.hidden).toBe(true);
    expect(panel.html).toContain('<ol class="suggestions"></ol>');
  });

  it("draws nothing for a field without a panel, and still leaves it on Escape", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const { render, calls } = rendered();
    const state = { calls: 0, render };
    mountSearch({
      islands: [
        island(
          { root: "", search: { action: "", placeholder: "" } },
          { input, container: fakePanel(false) },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render: (vnode, container) => {
        state.calls += 1;
        render(vnode, container);
      },
    });
    input.value = "key";
    input.fire("input");
    await settled();
    answer("meta", meta);
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(state.calls).toBe(0);
    expect(calls).toBe(0);
    input.focus();
    input.fire("keydown", keyEvent("Escape"));
    expect(input.focused).toBe(false);
  });

  it("reads empty props from an island without the attribute", () => {
    const { host, inject } = page();
    const element: SearchIslandElement<Panel> = {
      getAttribute: () => null,
      input: () => null,
      clear: () => null,
      panel: () => null,
      links: () => [],
      counter: () => null,
      container: () => fakePanel(false),
    };
    expect(
      mountSearch({
        islands: [element],
        document: fakeDocument(),
        location: fakeLocation(),
        scroll: fakeScroll(),
        defer: fakeDefer().defer,
        inject,
        host,
        render: rendered().render,
      }),
    ).toBe(1);
  });
});

describe("The arrow keys walk the live results", () => {
  function wired(hidden = false): {
    input: FakeInput;
    panel: Panel;
    links: FakeLink[];
  } {
    const input = fakeInput();
    const panel = fakePanel(hidden);
    const links = [fakeLink(), fakeLink(), fakeLink()];
    wireArrows(input, panel, () => links);
    return { input, panel, links };
  }

  it("reaches the first row from the field on ArrowDown, and leaves the field alone while the results are hidden or empty", () => {
    const { input, links } = wired();
    const down = keyEvent("ArrowDown");
    input.fire("keydown", down);
    expect(links.map((link) => link.focused)).toEqual([true, false, false]);
    expect(down.prevented).toBe(true);
    const other = keyEvent("ArrowUp");
    input.fire("keydown", other);
    expect(other.prevented).toBe(false);
    const asleep = wired(true);
    const ignored = keyEvent("ArrowDown");
    asleep.input.fire("keydown", ignored);
    expect(ignored.prevented).toBe(false);
    expect(asleep.links[0]?.focused).toBe(false);
    const empty = fakeInput();
    wireArrows(empty, fakePanel(false), () => []);
    const nothing = keyEvent("ArrowDown");
    empty.fire("keydown", nothing);
    expect(nothing.prevented).toBe(false);
  });

  it("moves down and up the rows, stays on the last one, returns to the field from the first, and hides the results on Escape", () => {
    const { input, panel, links } = wired();
    const [first, second, third] = links;
    const down = keyEvent("ArrowDown", { target: first });
    panel.press(down);
    expect(second?.focused).toBe(true);
    expect(down.prevented).toBe(true);
    panel.press(keyEvent("ArrowDown", { target: second }));
    expect(third?.focused).toBe(true);
    for (const link of links) link.focused = false;
    panel.press(keyEvent("ArrowDown", { target: third }));
    expect(third?.focused).toBe(true);
    panel.press(keyEvent("ArrowUp", { target: third }));
    expect(second?.focused).toBe(true);
    const up = keyEvent("ArrowUp", { target: first });
    panel.press(up);
    expect(input.focused).toBe(true);
    expect(up.prevented).toBe(true);
    input.focused = false;
    panel.press(keyEvent("Escape", { target: second }));
    expect(panel.hidden).toBe(true);
    expect(input.focused).toBe(true);
    // A key on something else in the panel, the link to the whole list for instance, and any other key on a row are left alone.
    const elsewhere = keyEvent("ArrowDown", { target: {} });
    panel.press(elsewhere);
    expect(elsewhere.prevented).toBe(false);
    const tab = keyEvent("Tab", { target: first });
    panel.press(tab);
    expect(tab.prevented).toBe(false);
  });
});

describe("suggestionOf and seeResultsHref", () => {
  it("turns an entry into a row with its type, its space by its declared name, and the documents of a keyword page", () => {
    const [note, screen, summary] = meta.entities;
    expect(suggestionOf(note as SearchEntry, meta, "../")).toEqual({
      title: "Keyword page",
      href: "../glossary/keyword-page/index.html",
      typeLabel: "Term",
      summary: "The page built for a word above the threshold.",
      glossary: true,
      cited: 4,
      space: "glossary",
    });
    expect(suggestionOf({ ...(screen as SearchEntry), source: "notes" }, meta, "")).toEqual({
      title: "Search results",
      href: "specs/screens/search-results/index.html",
      cited: 1,
      space: "notes",
    });
    const { cited, ...uncited } = screen as SearchEntry;
    expect(cited).toBe(1);
    expect(suggestionOf(uncited, meta, "").cited).toBe(0);
    expect(suggestionOf(summary as SearchEntry, meta, "")).toEqual({
      title: "build summary",
      href: "keywords/build-summary/index.html",
      typeLabel: "Keyword",
      keyword: true,
      documents: 6,
      space: "specs",
    });
    const { documents, ...uncounted } = summary as SearchEntry;
    expect(documents).toBe(6);
    expect(suggestionOf(uncounted, meta, "").documents).toBe(0);
  });

  it("tells the rows sharing a title apart by their space, or by their folder when a namesake shares the space, and leaves the others alone", () => {
    const row = (
      id: string,
      title: string,
      source: string,
    ): { entry: SearchEntry; suggestion: Suggestion } => {
      const entry: SearchEntry = {
        id,
        title,
        type: "term",
        url: `${id}/index.html`,
        status: "active",
        source,
      };
      return { entry, suggestion: suggestionOf(entry, meta, "") };
    };
    const rows = disambiguated([
      row("glossary/ingestion/source", "Source", "glossary"),
      row("specs/objects/ingestion/source", "Source", "specs"),
      row("glossary/note", "Note", "glossary"),
      row("specs/objects/ingestion/build", "Build", "specs"),
      row("specs/processes/build", "Build", "specs"),
      row("specs/build", "Build", "specs"),
      row("glossary/ingestion/build", "Build", "glossary"),
    ]);
    expect(rows.map((suggestion) => suggestion.qualifier)).toEqual([
      "glossary",
      "specs",
      undefined,
      "objects/ingestion",
      "processes",
      "specs",
      "glossary",
    ]);
    expect(rows[2]).toEqual(row("glossary/note", "Note", "glossary").suggestion);
  });

  it("leads to the results page with the query alone, readable in the address, the space of a space page kept as the source facet", () => {
    expect(seeResultsHref({ action: "../search/index.html", placeholder: "" }, "key word")).toBe(
      "../search/index.html?q=key+word",
    );
    expect(seeResultsHref({ action: "search/", placeholder: "" }, "")).toBe("search/");
    expect(seeResultsHref({ action: "search/", placeholder: "", source: "specs" }, "key")).toBe(
      "search/?q=key&source=specs",
    );
    expect(fieldState({ action: "search/", placeholder: "", source: "specs" }, "")).toEqual({
      query: "",
      filters: { type: [], source: ["specs"], domain: [], application: [] },
      noteless: "any",
    });
  });

  it("carries the facets the field of a category list submits with the query, and keeps its live results to them", () => {
    const field = {
      action: "../../search/index.html",
      placeholder: "Search in screens",
      filters: { source: "specs", type: "screen" },
    };
    expect(seeResultsHref(field, "home")).toBe(
      "../../search/index.html?q=home&type=screen&source=specs",
    );
    expect(fieldState(field, "home")).toEqual({
      query: "home",
      filters: { type: ["screen"], source: ["specs"], domain: [], application: [] },
      noteless: "any",
    });
    // A space named by both: the source of the field wins over its hidden fields.
    expect(fieldState({ ...field, source: "glossary" }, "").filters.source).toEqual(["glossary"]);
  });
});

interface ResultsPage {
  results: Panel;
  input: FakeInput;
  location: FakeLocation;
  scroll: FakeScroll;
  timers: FakeDefer;
  view: Rendered;
  injected: Injected[];
  answer: (name: string, data?: unknown) => void;
  follow: (href: string) => Promise<void>;
}

/** A results page mounted on an address, the table answered, ready for the facets. */
async function resultsPage(
  search: string,
  options: { scroll?: FakeScroll; table?: SearchMeta } = {},
): Promise<ResultsPage> {
  const { host, inject, injected, answer } = page();
  const input = fakeInput();
  const results = fakePanel(false);
  const location = fakeLocation(search);
  const scroll = options.scroll ?? fakeScroll();
  const timers = fakeDefer();
  const view = rendered();
  mountSearch({
    islands: [
      island(
        { root: "../", search: { action: "index.html", placeholder: "" } },
        { input, container: results },
      ),
      island(
        { root: "../", results: { query: "", total: 0, results: [], facets: [] } },
        { container: results },
      ),
    ],
    document: fakeDocument(),
    location,
    scroll,
    defer: timers.defer,
    inject,
    host,
    render: view.render,
  });
  answer("meta", options.table ?? meta);
  await settled();
  return {
    results,
    input,
    location,
    scroll,
    timers,
    view,
    injected,
    answer,
    follow: async (href) => {
      view.props().onNavigate?.(href);
      await settled();
    },
  };
}

describe("Facets on type, source, domain and application, with counts frozen at build", () => {
  it("shows the four facets with the count of every value over the results of the query, computed from the frozen table", async () => {
    const { results, view, injected } = await resultsPage("");
    expect(injected.map((script) => script.src)).toEqual(["../search/meta.js"]);
    expect(results.html).toContain(
      '<p class="search-summary" role="status">3 results, most cited first</p>',
    );
    expect(view.props().facets).toEqual([
      {
        name: "type",
        label: "Page type",
        values: [
          {
            value: "term",
            label: "Term",
            count: 1,
            href: "?type=term",
            active: false,
            disabled: false,
          },
          {
            value: "keyword",
            label: "Keyword",
            count: 1,
            href: "?type=keyword",
            active: false,
            disabled: false,
            keyword: true,
          },
        ],
      },
      {
        name: "source",
        label: "Space",
        values: [
          {
            value: "glossary",
            label: "glossary",
            count: 1,
            href: "?source=glossary",
            active: false,
            disabled: false,
          },
          {
            value: "specs",
            label: "specs",
            count: 2,
            href: "?source=specs",
            active: false,
            disabled: false,
          },
        ],
      },
      {
        name: "domain",
        label: "Domain",
        folded: true,
        values: [
          {
            value: "publication",
            label: "Publication",
            count: 1,
            href: "?domain=publication",
            active: false,
            disabled: false,
          },
        ],
      },
      {
        name: "application",
        label: "Application",
        folded: true,
        values: [
          {
            value: "concordance-cli",
            label: "Command line",
            count: 2,
            href: "?application=concordance-cli",
            active: false,
            disabled: false,
          },
        ],
      },
      {
        name: "nonote",
        label: "Without a note",
        folded: true,
        values: [
          { value: "any", label: "Included", count: 3, href: "?", active: true, disabled: false },
          {
            value: "only",
            label: "Only",
            count: 1,
            href: "?nonote=only",
            active: false,
            disabled: false,
          },
          {
            value: "exclude",
            label: "Excluded",
            count: 2,
            href: "?nonote=exclude",
            active: false,
            disabled: false,
          },
        ],
      },
    ]);
    expect(results.html).toContain(
      '<nav class="facets" aria-label="Filters"><details class="facets-fold"><summary class="facets-head">Filters</summary><div class="facet-groups"><details class="facet" open><summary><h2>Page type</h2></summary><ul class="facet-values"><li class="facet-value"><input type="checkbox" id="facet-type-term" name="type" value="term"/><label for="facet-type-term"><span class="facet-label">Term</span><span class="count">1</span></label></li><li class="facet-value facet-keyword"><input type="checkbox" id="facet-type-keyword" name="type" value="keyword"/><label for="facet-type-keyword"><span class="facet-label">Keyword</span><span class="count">1</span></label></li>',
    );
    expect(results.html).toContain(
      '<details class="facet"><summary><h2>Domain</h2></summary><ul class="facet-values">',
    );
    expect(results.html).toContain(
      '<p class="facets-note">The counters are set when the site is published. Filtering happens in the browser, without a round trip.</p></div></details></nav>',
    );
    expect(results.html).toContain(
      '<p class="results-note">Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.</p>',
    );
  });

  it("counts over the results of the query, not the whole site", async () => {
    const { results, view, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<p class="search-summary" role="status">2 results, most cited first</p>',
    );
    expect(
      view
        .props()
        .facets.map((facet) =>
          facet.values.map((value) => `${value.value}:${String(value.count)}`),
        ),
    ).toEqual([
      ["term:1", "keyword:1"],
      ["glossary:1", "specs:1"],
      ["publication:1"],
      ["concordance-cli:1"],
      ["any:2", "only:1", "exclude:1"],
    ]);
  });
});

describe("Facets combine, and filtering happens in the browser", () => {
  it("keeps the results carrying a selected value of every facet, without loading anything else", async () => {
    const { results, view, follow, injected, location, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    expect(injected.map((script) => script.src)).toEqual(["../search/meta.js", "../search/ke.js"]);
    await follow("?q=key&source=specs");
    expect(location.pushed).toEqual(["?q=key&source=specs"]);
    expect(injected).toHaveLength(2);
    await follow("?q=key&type=term&source=specs");
    expect(injected).toHaveLength(2);
    expect(view.props().active).toEqual([
      {
        name: "type",
        value: "term",
        facetLabel: "Page type",
        label: "Term",
        href: "?q=key&source=specs",
      },
      {
        name: "source",
        value: "specs",
        facetLabel: "Space",
        label: "specs",
        href: "?q=key&type=term",
      },
    ]);
    expect(results.html).toContain(
      '<p class="results-empty-lead" role="status">No result for “key” with the filters Term, specs.</p><p class="results-empty-cause">The word exists in the documentation, but on none of the pages the filter keeps.</p>',
    );
    expect(view.props().empty).toEqual({
      explanation:
        "The word exists in the documentation, but on none of the pages the filter keeps.",
      exits: [
        { label: "Remove the filter “Term”", href: "?q=key&source=specs", count: 1 },
        { label: "Remove the filter “specs”", href: "?q=key&type=term", count: 1 },
      ],
    });
    expect(results.html).not.toContain('<ol class="results">');
  });

  it("intersects the facets: a type and a source keep the entities carrying both", async () => {
    const { results, view, follow, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    await follow("?q=key&source=specs");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("build summary");
    expect(results.html).not.toContain("Keyword page");
    await follow("?q=key&source=glossary,specs");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">2 results, most cited first</p>',
    );
    await follow("?q=key&type=term&source=glossary,specs");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("Keyword page");
    expect(
      view.props().facets[1]?.values.map((value) => [value.value, value.count, value.active]),
    ).toEqual([
      ["glossary", 1, true],
      ["specs", 0, true],
    ]);
  });
});

describe("A facet with no result under the current filters is disabled, not hidden", () => {
  it("lists a value nothing would come of with its count at 0, its box disabled", async () => {
    const { results, view, follow, location } = await resultsPage("");
    await follow("?type=keyword");
    expect(view.props().facets[2]).toEqual({
      name: "domain",
      label: "Domain",
      folded: true,
      values: [
        {
          value: "publication",
          label: "Publication",
          count: 0,
          href: "?type=keyword&domain=publication",
          active: false,
          disabled: true,
        },
      ],
    });
    expect(results.html).toContain(
      '<details class="facet"><summary><h2>Domain</h2></summary><ul class="facet-values"><li class="facet-value facet-disabled"><input type="checkbox" id="facet-domain-publication" name="domain" value="publication" disabled/><label for="facet-domain-publication"><span class="facet-label">Publication</span><span class="count">0</span></label></li></ul></details>',
    );
    expect(results.html).toContain(
      '<li class="facet-value facet-active facet-keyword"><input type="checkbox" id="facet-type-keyword" name="type" value="keyword" checked/><label for="facet-type-keyword"><span class="facet-label">Keyword</span><span class="count">1</span></label></li>',
    );
    expect(results.html).toContain('<li class="clear-filters"><a href="?">Clear filters</a></li>');
    expect(results.html).toContain(
      '<li class="facet-value"><input type="checkbox" id="facet-type-term" name="type" value="term"/><label for="facet-type-term"><span class="facet-label">Term</span><span class="count">1</span></label></li>',
    );
    await follow("?");
    expect(location.pushed).toEqual(["?type=keyword", ""]);
    expect(results.html).toContain(
      '<p class="search-summary" role="status">3 results, most cited first</p>',
    );
  });
});

describe("Active filters are recalled above the results and removable one by one", () => {
  it("draws every selected value as a chip lifting it, and a link clearing them all", async () => {
    const { results, view, follow, location, input, answer } = await resultsPage(
      "?q=key&type=keyword,term&source=specs",
    );
    expect(input.value).toBe("key");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<ul class="active-filters" aria-label="Active filters"><li class="active-filter"><a href="?q=key&amp;type=term&amp;source=specs" class="remove-filter"><span class="visually-hidden">Remove this filter Page type: </span>Keyword <span aria-hidden="true">✕</span></a></li><li class="active-filter"><a href="?q=key&amp;type=keyword&amp;source=specs" class="remove-filter"><span class="visually-hidden">Remove this filter Page type: </span>Term <span aria-hidden="true">✕</span></a></li>',
    );
    expect(results.html).toContain(
      '<li class="clear-filters"><a href="?q=key">Clear filters</a></li></ul>',
    );
    await follow("?q=key&type=term&source=specs");
    expect(view.props().active?.map((filter) => filter.value)).toEqual(["term", "specs"]);
    await follow("?q=key");
    expect(view.props().active).toBeUndefined();
    expect(view.props().clearHref).toBeUndefined();
    expect(results.html).not.toContain("active-filters");
    expect(location.pushed).toEqual(["?q=key&type=term&source=specs", "?q=key"]);
    expect(location.current).toBe("?q=key");
  });

  it("gives an empty view without the table, the address keeping its query", () => {
    expect(
      resultsPropsOf(parseSearchState("?q=key&type=term"), { query: "key", hits: [] }, "", {
        onNavigate: () => undefined,
        shown: 20,
        onMore: () => undefined,
      }),
    ).toEqual({
      query: "key",
      total: 0,
      results: [],
      facets: [],
    });
  });
});

describe("The bar shows the query in the field with a clear button", () => {
  it("shows the button while the field holds a query, on the address, as the reader types and as a facet is followed, and hides it otherwise", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const clear = fakeClear();
    const results = fakePanel(false);
    const location = fakeLocation("?q=key&type=term");
    const view = rendered();
    mountSearch({
      islands: [
        island(
          { root: "../", search: { action: "index.html", placeholder: "" } },
          { input, clear, container: results },
        ),
        island(
          { root: "../", results: { query: "", total: 0, results: [], facets: [] } },
          { container: results },
        ),
      ],
      document: fakeDocument(),
      location,
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render: view.render,
    });
    expect(input.value).toBe("key");
    expect(clear.hidden).toBe(false);
    answer("meta", meta);
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    view.props().onNavigate?.("?type=term");
    await settled();
    expect(input.value).toBe("");
    expect(clear.hidden).toBe(true);
    input.value = "se";
    input.fire("input");
    expect(clear.hidden).toBe(false);
    location.pop("?q=key");
    await settled();
    expect(input.value).toBe("key");
    expect(clear.hidden).toBe(false);
    location.pop("");
    await settled();
    expect(clear.hidden).toBe(true);
  });

  it("clears the field on click, rewrites the address at once, lists the whole table and gives the focus back to the field", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const clear = fakeClear();
    const results = fakePanel(false);
    const location = fakeLocation("?q=key&source=glossary");
    const timers = fakeDefer();
    const view = rendered();
    mountSearch({
      islands: [
        island(
          { root: "../", search: { action: "index.html", placeholder: "" } },
          { input, clear, container: results },
        ),
        island(
          { root: "../", results: { query: "", total: 0, results: [], facets: [] } },
          { container: results },
        ),
      ],
      document: fakeDocument(),
      location,
      scroll: fakeScroll(),
      defer: timers.defer,
      inject,
      host,
      render: view.render,
    });
    answer("meta", meta);
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    input.value = "keyw";
    input.fire("input");
    expect(timers.pending).toHaveLength(1);
    clear.click();
    expect(timers.cancelled).toBe(1);
    expect(input.value).toBe("");
    expect(input.focused).toBe(true);
    expect(clear.hidden).toBe(true);
    expect(location.replaced).toEqual(["?source=glossary"]);
    await settled();
    expect(view.props().query).toBe("");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("Keyword page");
    expect(view.props().active?.map((filter) => filter.value)).toEqual(["glossary"]);
  });

  it("clears the field under the header of any page, the suggestions hidden, without touching the address", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const clear = fakeClear();
    const panel = fakePanel(true);
    const location = fakeLocation("");
    mountSearch({
      islands: [
        island(
          { root: "../", search: { action: "search/index.html", placeholder: "" } },
          { input, clear, panel, container: panel },
        ),
      ],
      document: fakeDocument(),
      location,
      scroll: fakeScroll(),
      defer: fakeDefer().defer,
      inject,
      host,
      render: rendered().render,
    });
    input.fire("focus");
    answer("meta", meta);
    input.value = "key";
    input.fire("input");
    await settled();
    answer("ke", shards["ke"]);
    await settled();
    expect(panel.hidden).toBe(false);
    clear.click();
    await settled();
    expect(input.value).toBe("");
    expect(panel.hidden).toBe(true);
    expect(location.replaced).toEqual([]);
    expect(location.pushed).toEqual([]);
  });
});

describe("The query and active filters are encoded in the URL parameters", () => {
  it("pushes an entry to the history for a facet followed, and rewrites the current one once the reader pauses typing", async () => {
    const { input, location, timers, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    input.value = "ke";
    input.fire("input");
    input.value = "key";
    input.fire("input");
    expect(location.replaced).toEqual([]);
    expect(timers.pending.map((entry) => entry.delay)).toEqual([300]);
    expect(timers.cancelled).toBe(1);
    timers.flush();
    expect(location.replaced).toEqual(["?q=key"]);
    input.value = "keyword";
    input.fire("input");
    await settled();
    answer("ke", shards["ke"]);
    expect(timers.pending).toHaveLength(1);
    expect(location.current).toBe("?q=key");
  });

  it("drops a pending rewrite when a facet is followed, the pushed address carrying the query typed", async () => {
    const { input, location, timers, follow, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    input.value = "keyword";
    input.fire("input");
    await settled();
    await follow("?q=keyword&type=term");
    expect(timers.pending).toEqual([]);
    expect(timers.cancelled).toBe(1);
    expect(location.pushed).toEqual(["?q=keyword&type=term"]);
    expect(location.replaced).toEqual([]);
    expect(input.value).toBe("keyword");
  });
});

describe("Opening the URL restores the query, the filters and the scroll position", () => {
  it("reads the state of the address, runs the query with the facets applied, then scrolls where the address was left", async () => {
    const scroll = fakeScroll({ "?q=key&type=term": 480, "?q=key": 40 });
    const { results, input, view, answer } = await resultsPage("?q=key&type=term", { scroll });
    expect(input.value).toBe("key");
    expect(scroll.scrolledTo).toEqual([]);
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("Keyword page");
    expect(view.props().active?.map((filter) => filter.value)).toEqual(["term"]);
    expect(scroll.scrolledTo).toEqual([480]);
  });

  it("opens at the top an address never left, and remembers the position by address as the reader scrolls", async () => {
    const scroll = fakeScroll();
    const { follow, input, timers } = await resultsPage("", { scroll });
    expect(scroll.scrolledTo).toEqual([]);
    scroll.at = 120;
    scroll.fire();
    expect(scroll.stored).toEqual({ "": 120 });
    await follow("?type=term");
    scroll.at = 60;
    scroll.fire();
    expect(scroll.stored).toEqual({ "": 120, "?type=term": 60 });
    input.value = "ke";
    input.fire("input");
    timers.flush();
    scroll.at = 10;
    scroll.fire();
    expect(scroll.stored["?q=ke&type=term"]).toBe(10);
    expect(scroll.scrolledTo).toEqual([]);
  });
});

describe("The browser's back navigation returns to the previous state", () => {
  it("replays the state of the address on popstate, the field, the facets and the scroll included", async () => {
    const scroll = fakeScroll({ "?q=key": 200 });
    const { results, input, location, follow, view, answer, timers } = await resultsPage("?q=key", {
      scroll,
    });
    answer("ke", shards["ke"]);
    await settled();
    await follow("?q=key&type=term");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    input.value = "keyw";
    input.fire("input");
    expect(timers.pending).toHaveLength(1);
    location.pop("?q=key");
    await settled();
    expect(timers.pending).toEqual([]);
    expect(input.value).toBe("key");
    expect(view.props().active).toBeUndefined();
    expect(results.html).toContain(
      '<p class="search-summary" role="status">2 results, most cited first</p>',
    );
    expect(scroll.scrolledTo).toEqual([200, 200]);
    expect(location.pushed).toEqual(["?q=key&type=term"]);
    location.pop("");
    await settled();
    expect(input.value).toBe("");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">3 results, most cited first</p>',
    );
    expect(scroll.scrolledTo).toEqual([200, 200]);
  });
});

describe("scrollMemory and storageOf", () => {
  it("keeps the position by query string in the storage, restores a finite one, and drives the view", () => {
    const store = new Map<string, string>();
    const listeners: (() => void)[] = [];
    const view = {
      scrollY: 0,
      moved: [] as [number, number][],
      scrollTo(x: number, y: number) {
        view.moved.push([x, y]);
      },
      addEventListener(_type: "scroll", listener: () => void) {
        listeners.push(listener);
      },
    };
    const memory = scrollMemory(
      { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
      view,
    );
    expect(memory.remembered("?q=key")).toBeUndefined();
    memory.remember("?q=key", 250);
    expect(store.get(`${SCROLL_KEY}?q=key`)).toBe("250");
    expect(memory.remembered("?q=key")).toBe(250);
    store.set(`${SCROLL_KEY}?q=bad`, "far");
    expect(memory.remembered("?q=bad")).toBeUndefined();
    view.scrollY = 30;
    expect(memory.position()).toBe(30);
    memory.scrollTo(250);
    expect(view.moved).toEqual([[0, 250]]);
    let fired = 0;
    memory.onScroll(() => {
      fired += 1;
    });
    for (const listener of listeners) listener();
    expect(fired).toBe(1);
  });

  it("remembers nothing without a storage or with one that refuses, and gives none when the storage cannot be reached", () => {
    const view = { scrollY: 0, scrollTo: () => undefined, addEventListener: () => undefined };
    const none = scrollMemory(undefined, view);
    none.remember("?q=key", 1);
    expect(none.remembered("?q=key")).toBeUndefined();
    const refusing = scrollMemory(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      view,
    );
    expect(() => {
      refusing.remember("?q=key", 1);
    }).not.toThrow();
    expect(
      storageOf(() => {
        throw new Error("denied");
      }),
    ).toBeUndefined();
    const storage = { getItem: () => null, setItem: () => undefined };
    expect(storageOf(() => storage)).toBe(storage);
    expect(REPLACE_DELAY).toBe(300);
  });
});

describe("Recurring expressions without a note appear among the results, with a dotted outline", () => {
  it("draws a keyword page as a result of class result-keyword, on the results page and under the header field alike", async () => {
    const { results, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<li class="result result-keyword"><p class="result-head"><span class="badge">Keyword</span><a class="result-title" href="../keywords/build-summary/index.html">build summary</a></p><p class="result-detail">Used in 6 documents, never defined in the glossary</p></li>',
    );
    expect(results.html).toContain(
      '<li class="result result-lead"><p class="result-head"><span class="badge">Term</span><a class="result-title" href="../glossary/keyword-page/index.html">',
    );
  });
});

describe("The first batch of rows is drawn, a button adds the next one in place", () => {
  /** A table of many terms, each matching "term", so that the page holds more than one batch. */
  function many(count: number): { table: SearchMeta; shard: ShardData } {
    const table: SearchMeta = {
      ...meta,
      entities: Array.from({ length: count }, (_, at) => ({
        id: `glossary/term-${String(at).padStart(2, "0")}`,
        title: `Term ${String(at)}`,
        type: "term",
        url: `glossary/term-${String(at)}/index.html`,
        status: "active",
        source: "glossary",
        cited: count - at,
      })),
      shards: ["te"],
    };
    return { table, shard: { term: table.entities.map((_, at) => [at, 5]) } };
  }

  it("draws twenty rows and the button worded with the size of the next batch, adds a batch per click, and drops the button once every row is drawn", async () => {
    const { table, shard } = many(45);
    const { results, view, answer } = await resultsPage("?q=term", { table });
    answer("te", shard);
    await settled();
    expect(RESULTS_BATCH).toBe(20);
    expect(view.props().total).toBe(45);
    expect(view.props().results).toHaveLength(20);
    expect(results.html).toContain(
      '<button type="button" class="results-more">Show the next 20</button>',
    );
    expect(results.html).toContain(
      '<p class="search-summary" role="status">45 results, most cited first</p>',
    );
    view.props().more?.onMore();
    expect(view.props().results).toHaveLength(40);
    expect(view.props().more?.label).toBe("Show the next 5");
    view.props().more?.onMore();
    expect(view.props().results).toHaveLength(45);
    expect(view.props().more).toBeUndefined();
    expect(results.html).not.toContain("results-more");
  });

  it("words the button for the last row alone, and starts again from the first batch when the state changes", async () => {
    const { table, shard } = many(21);
    const { results, view, answer, follow, input } = await resultsPage("?q=term", { table });
    answer("te", shard);
    await settled();
    expect(view.props().more?.label).toBe("Show the next one");
    view.props().more?.onMore();
    expect(view.props().results).toHaveLength(21);
    await follow("?q=term&source=glossary");
    expect(view.props().results).toHaveLength(20);
    expect(view.props().more?.label).toBe("Show the next one");
    view.props().more?.onMore();
    expect(view.props().more).toBeUndefined();
    input.value = "term";
    input.fire("input");
    await settled();
    expect(view.props().results).toHaveLength(20);
    expect(results.html).toContain("results-more");
  });

  it("draws no button when the rows fit in one batch", async () => {
    const { results, view, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    expect(view.props().results).toHaveLength(2);
    expect(view.props().more).toBeUndefined();
    expect(results.html).not.toContain("results-more");
  });
});

describe("Their row states the number of files, and that no note defines the expression", () => {
  it("words the documents of the table in the site language, 0 for a page without them", () => {
    const summary = meta.entities[2];
    expect(summary === undefined ? "" : keywordDetail(summary, meta)).toBe(
      "Used in 6 documents, never defined in the glossary",
    );
    const bare: SearchEntry = {
      id: "k",
      title: "k",
      type: "keyword",
      url: "k/",
      status: "valid",
      source: "specs",
      keyword: true,
    };
    expect(keywordDetail({ ...bare, occurrences: 1, documents: 1 }, meta)).toBe(
      "Used in 1 document, never defined in the glossary",
    );
    expect(keywordDetail(bare, meta)).toBe("Used in 0 documents, never defined in the glossary");
    expect(resultOf(bare, meta, "").detail).toBe(
      "Used in 0 documents, never defined in the glossary",
    );
  });
});

describe("The empty state tells a filtered word apart from a word no file uses", () => {
  it("offers to lift each filter with the count of what comes back, then the page of the word when the corpus has one", () => {
    const state = parseSearchState("?q=Keyword+page&type=keyword&nonote=exclude");
    const active = activeFiltersOf(meta, state, resultsHref);
    const empty = emptyOf(state, meta.entities, meta, "../", active);
    expect(empty).toEqual({
      explanation:
        "The word exists in the documentation, but on none of the pages the filter keeps.",
      exits: [
        { label: "Remove the filter “Keyword”", href: "?q=Keyword+page&nonote=exclude", count: 2 },
        { label: "Remove the filter “Excluded”", href: "?q=Keyword+page&type=keyword", count: 1 },
        {
          label: "See the page of the word",
          href: "../glossary/keyword-page/index.html",
          count: 4,
          secondary: true,
        },
      ],
    });
    expect(emptySummary(state, meta.entities, meta, active)).toBe(
      "No result for “Keyword page” with the filters Keyword, Excluded.",
    );
    const one = parseSearchState("?q=word+page&type=keyword");
    const oneFilter = activeFiltersOf(meta, one, resultsHref);
    expect(emptySummary(one, meta.entities, meta, oneFilter)).toBe(
      "No result for “word page” with the filter Keyword.",
    );
    expect(emptyOf(one, meta.entities, meta, "", oneFilter).exits.at(-1)).toEqual({
      label: "See the page of the word",
      href: "glossary/keyword-page/index.html",
      count: 4,
      secondary: true,
    });
  });

  it("says no file uses the word, with the page of the word when the corpus has one and the note on the prefix search", () => {
    const state = parseSearchState("?q=zebra&source=specs");
    const active = activeFiltersOf(meta, state, resultsHref);
    expect(emptyOf(state, [], meta, "", active)).toEqual({
      explanation: "No file uses this word.",
      exits: [],
      note: "The search matches the start of words: a typo gives zero results and no suggestion.",
    });
    expect(emptySummary(state, [], meta, active)).toBe("No result for “zebra”");
    expect(emptySummary(state, meta.entities, meta, [])).toBe("No result for “zebra”");
    const keyword = parseSearchState("?q=BUILD+summary");
    expect(emptyOf(keyword, [], meta, "", []).exits).toEqual([
      {
        label: "See the page of the word",
        href: "keywords/build-summary/index.html",
        count: 17,
        secondary: true,
      },
    ]);
    const uncounted = meta.entities.map((entry) => {
      const bare = { ...entry };
      delete bare.cited;
      delete bare.occurrences;
      return bare;
    });
    const bare = { ...meta, entities: uncounted };
    expect(emptyOf(parseSearchState("?q=keyword+page"), [], bare, "", []).exits[0]?.count).toBe(0);
    expect(emptyOf(parseSearchState("?q=build+summary"), [], bare, "", []).exits[0]?.count).toBe(0);
  });
});

describe("No result: the closest form of the dictionary is proposed, and the empty state names the query", () => {
  it("proposes the title or alias sharing the longest prefix with the query, with its citations or its occurrences, under the same filters", async () => {
    const { results, view, answer } = await resultsPage("?q=keywort&source=glossary");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<p class="results-empty-lead" role="status">No result for “keywort”</p><p class="results-empty-cause">No file uses this word.</p><p class="search-closest">',
    );
    expect(view.props().empty).toEqual({
      explanation: "No file uses this word.",
      exits: [],
      note: "The search matches the start of words: a typo gives zero results and no suggestion.",
    });
    expect(view.props().closest).toEqual({
      form: "Keyword page",
      href: "?q=Keyword+page&source=glossary",
      detail: "cited in 4 pages",
    });
    expect(results.html).toContain(
      '<p class="search-closest">Closest form: <a href="?q=Keyword+page&amp;source=glossary">Keyword page</a>, cited in 4 pages</p><p class="results-empty-note">',
    );
    expect(results.html).not.toContain("results-note");
    expect(closestOf(parseSearchState("?q=build+sum"), meta)).toEqual({
      form: "build summary",
      href: "?q=build+summary",
      detail: "17 occurrences",
    });
    expect(closestOf(parseSearchState("?q=zebra"), meta)).toBeUndefined();
    expect(closestOf(parseSearchState("?q=word"), { ...meta, entities: [] })).toBeUndefined();
    const bare: SearchEntry = {
      id: "keywords/cold-start",
      title: "cold start",
      type: "keyword",
      url: "keywords/cold-start/index.html",
      status: "valid",
      source: "specs",
      keyword: true,
    };
    expect(closestOf(parseSearchState("?q=cold"), { ...meta, entities: [bare] })).toEqual({
      form: "cold start",
      href: "?q=cold+start",
      detail: "0 occurrences",
    });
  });

  it("proposes nothing when the query matched and the filters alone emptied the list, or when the query has no word", async () => {
    const { results, view, follow, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    await follow("?q=key&type=term&nonote=only");
    expect(results.html).toContain(
      '<p class="results-empty-lead" role="status">No result for “key” with the filters Term, Only.</p>',
    );
    expect(view.props().closest).toBeUndefined();
    expect(view.props().empty?.exits).toEqual([
      { label: "Remove the filter “Term”", href: "?q=key&nonote=only", count: 1 },
      { label: "Remove the filter “Only”", href: "?q=key&type=term", count: 1 },
    ]);
    await follow("?nonote=only&source=glossary");
    expect(results.html).toContain('<p class="search-summary" role="status">No result</p>');
    expect(view.props().closest).toBeUndefined();
  });
});

describe("A no-note facet isolates or excludes them", () => {
  it("keeps the keyword pages alone under only, leaves them out under exclude, and recalls the choice above the results", async () => {
    const { results, view, follow, answer, location } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<p class="search-summary" role="status">2 results, most cited first</p>',
    );
    await follow("?q=key&nonote=only");
    expect(location.current).toBe("?q=key&nonote=only");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("build summary");
    expect(results.html).not.toContain("Keyword page");
    expect(view.props().active).toEqual([
      {
        name: "nonote",
        value: "only",
        facetLabel: "Without a note",
        label: "Only",
        href: "?q=key",
      },
    ]);
    expect(
      view
        .props()
        .facets[4]?.values.map((value) => [value.value, value.count, value.active, value.disabled]),
    ).toEqual([
      ["any", 2, false, false],
      ["only", 1, true, false],
      ["exclude", 1, false, false],
    ]);
    expect(view.props().facets[0]?.values.map((value) => [value.value, value.count])).toEqual([
      ["term", 0],
      ["keyword", 1],
    ]);
    await follow("?q=key&nonote=exclude");
    expect(results.html).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results.html).toContain("Keyword page");
    expect(results.html).not.toContain("build summary");
    await follow("?q=key&type=term&nonote=only");
    expect(results.html).toContain(
      '<p class="results-empty-lead" role="status">No result for “key” with the filters Term, Only.</p>',
    );
    expect(
      view.props().facets[4]?.values.map((value) => [value.value, value.count, value.disabled]),
    ).toEqual([
      ["any", 1, false],
      ["only", 0, false],
      ["exclude", 1, false],
    ]);
    await follow("?q=key");
    expect(view.props().active).toBeUndefined();
  });
});

describe("They are never ranked before an entity of equivalent relevance", () => {
  it("puts an entity before a keyword page of the same score whatever their order in the table, and lists the keyword pages last without a query", () => {
    const table: SearchMeta = {
      ...meta,
      entities: [
        { ...(meta.entities[2] as SearchEntry) },
        { ...(meta.entities[0] as SearchEntry) },
        { ...(meta.entities[1] as SearchEntry) },
      ],
    };
    const tied = new Map<string, ShardData>([
      [
        "ke",
        {
          keyword: [
            [0, 5],
            [1, 5],
            [2, 5],
          ],
          keywords: [[0, 1]],
        },
      ],
    ]);
    expect(hitsOf("key", table, tied).map((hit) => [hit.entry.id, hit.score])).toEqual([
      ["glossary/keyword-page", 5],
      ["specs/screens/search-results", 5],
      ["keywords/build-summary", 5],
    ]);
    tied.set("ke", {
      keyword: [
        [0, 6],
        [1, 5],
      ],
    });
    expect(hitsOf("key", table, tied).map((hit) => hit.entry.id)).toEqual([
      "keywords/build-summary",
      "glossary/keyword-page",
    ]);
    expect(hitsOf("", table, tied).map((hit) => hit.entry.id)).toEqual([
      "glossary/keyword-page",
      "specs/screens/search-results",
      "keywords/build-summary",
    ]);
  });
});
