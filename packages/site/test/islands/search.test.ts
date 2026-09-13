import type { JSX } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import {
  hitsOf,
  isEditable,
  mountSearch,
  REPLACE_DELAY,
  resultOf,
  resultsPropsOf,
  SCROLL_KEY,
  scrollMemory,
  searchRunner,
  shardLoader,
  storageOf,
  SUGGESTIONS,
  wireShortcuts,
  type KeyEvent,
  type ScriptInjector,
  type SearchInput,
  type SearchIslandElement,
  type Defer,
  type ScrollMemory,
  type SearchIslands,
  type SearchLocation,
  type SearchPanel,
  type ShardHost,
} from "../../src/islands/search.js";
import type { SearchMeta, ShardData } from "../../src/search/shared.js";
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
    },
    {
      id: "specs/screens/search-results",
      title: "Search results",
      type: "screen",
      url: "specs/screens/search-results/index.html",
      application: "concordance-cli",
      status: "active",
      source: "specs",
    },
    {
      id: "keywords/build-summary",
      title: "build summary",
      type: "keyword",
      url: "keywords/build-summary/index.html",
      status: "valid",
      source: "specs",
    },
  ],
  shards: ["ke", "pa", "se"],
  types: { keyword: "Keyword", term: "Term" },
  applications: { "concordance-cli": "Command line" },
  domains: { publication: "Publication" },
  sources: { glossary: "glossary", specs: "specs" },
  counts: {
    type: { keyword: 1, term: 1 },
    source: { glossary: 1, specs: 2 },
    domain: { publication: 1 },
    application: { "concordance-cli": 2 },
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
  it("turns the ranked entities into results with the title, the type badge, the breadcrumb and the href from the page", () => {
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
        breadcrumb: ["Command line", "Publication"],
      },
      {
        title: "build summary",
        href: "../keywords/build-summary/index.html",
        typeLabel: "Keyword",
      },
    ]);
    expect(hitsOf("search", meta, loaded).map((hit) => resultOf(hit.entry, meta, ""))).toEqual([
      {
        title: "Search results",
        href: "specs/screens/search-results/index.html",
        breadcrumb: ["Command line"],
      },
    ]);
  });

  it("lists the whole table, scored 0, for a query without a word, so that the facets alone browse the site", () => {
    expect(hitsOf("", meta, new Map()).map((hit) => [hit.entry.id, hit.score])).toEqual([
      ["glossary/keyword-page", 0],
      ["specs/screens/search-results", 0],
      ["keywords/build-summary", 0],
    ]);
    expect(hitsOf(" a ", meta, new Map())).toHaveLength(3);
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
}

function island(
  props: Record<string, unknown>,
  parts: { input?: FakeInput; panel?: Panel; container: Panel },
): SearchIslandElement<Panel> {
  return {
    getAttribute: (name) => (name === "data-props" ? JSON.stringify(props) : null),
    input: () => parts.input ?? null,
    panel: () => parts.panel ?? null,
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
    href: () => `file:///dist/search/index.html${location.current}`,
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
  it("shows the best results under the header field as the reader types, at most eight, and hides them when nothing matches", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel: Panel = { hidden: true, html: "" };
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
      clipboard: undefined,
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
      '<ol class="results"><li class="result"><a href="../glossary/keyword-page/index.html">Keyword page</a><span class="badge">Term</span><span class="breadcrumb">Command line / Publication</span></li><li class="result"><a href="../keywords/build-summary/index.html">build summary</a><span class="badge">Keyword</span></li></ol>',
    );
    input.value = "zebra";
    input.fire("input");
    await settled();
    expect(panel.hidden).toBe(true);
    expect(panel.html).toBe('<ol class="results"></ol>');
    input.fire("keydown", keyEvent("Escape"));
    expect(panel.hidden).toBe(true);
    expect(SUGGESTIONS).toBe(8);
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
    const panel: Panel = { hidden: true, html: "" };
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
      clipboard: undefined,
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
    expect(panel.html.match(/<li class="result">/g)).toHaveLength(8);
  });

  it("fills the results page from the query of the address and follows the field, the suggestions staying hidden", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const panel: Panel = { hidden: true, html: "" };
    const results: Panel = { hidden: false, html: "" };
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
      clipboard: undefined,
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
    expect(results.html).toContain('<div class="search-results"><h1>Search</h1>');
    expect(results.html).toContain('<p class="search-summary">1 result</p>');
    expect(results.html).toContain(
      '<a href="../glossary/keyword-page/index.html">Keyword page</a>',
    );
    expect(panel.html).toBe("");
    expect(panel.hidden).toBe(true);
    input.value = "search";
    input.fire("input");
    await settled();
    answer("se", shards["se"]);
    await settled();
    expect(results.html).toContain('<p class="search-summary">1 result</p>');
    expect(results.html).toContain("Search results");
    expect(results.html).not.toContain("Keyword page");
    input.value = "zebra";
    input.fire("input");
    await settled();
    expect(results.html).toContain('<p class="search-summary">No result</p>');
  });

  it("keeps the latest query when an earlier one answers later", async () => {
    const { host, inject, answer } = page();
    const input = fakeInput();
    const results: Panel = { hidden: false, html: "" };
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
      clipboard: undefined,
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

  it("wires the shortcuts alone for a field without an index, and does nothing for a page without a field", () => {
    const { host, inject, injected } = page();
    const input = fakeInput();
    const document = fakeDocument();
    const { render, calls } = rendered();
    const mounted = mountSearch({
      islands: [
        island(
          { search: { action: "search/", placeholder: "" } },
          { input, container: { hidden: false, html: "" } },
        ),
      ],
      document,
      location: fakeLocation("?q=key"),
      scroll: fakeScroll(),
      clipboard: undefined,
      defer: fakeDefer().defer,
      inject,
      host,
      render,
    });
    expect(mounted).toBe(1);
    document.press(keyEvent("/"));
    expect(input.focused).toBe(true);
    input.fire("focus");
    input.fire("input");
    expect(injected).toEqual([]);
    expect(calls).toBe(0);
    const results: Panel = { hidden: false, html: "" };
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
        clipboard: undefined,
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
        clipboard: undefined,
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
    const panel: Panel = { hidden: true, html: "" };
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
      clipboard: undefined,
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
    expect(panel.html).toBe('<ol class="results"></ol>');
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
          { input, container: { hidden: false, html: "" } },
        ),
      ],
      document: fakeDocument(),
      location: fakeLocation(),
      scroll: fakeScroll(),
      clipboard: undefined,
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
      panel: () => null,
      container: () => ({ hidden: false, html: "" }),
    };
    expect(
      mountSearch({
        islands: [element],
        document: fakeDocument(),
        location: fakeLocation(),
        scroll: fakeScroll(),
        clipboard: undefined,
        defer: fakeDefer().defer,
        inject,
        host,
        render: rendered().render,
      }),
    ).toBe(1);
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
  options: { scroll?: FakeScroll; clipboard?: { writeText(text: string): Promise<void> } } = {},
): Promise<ResultsPage> {
  const { host, inject, injected, answer } = page();
  const input = fakeInput();
  const results: Panel = { hidden: false, html: "" };
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
    clipboard: options.clipboard,
    defer: timers.defer,
    inject,
    host,
    render: view.render,
  });
  answer("meta", meta);
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
    expect(results.html).toContain('<p class="search-summary">3 results</p>');
    expect(view.props().facets).toEqual([
      {
        name: "type",
        label: "Type",
        values: [
          {
            value: "keyword",
            label: "Keyword",
            count: 1,
            href: "?type=keyword",
            active: false,
            disabled: false,
          },
          {
            value: "term",
            label: "Term",
            count: 1,
            href: "?type=term",
            active: false,
            disabled: false,
          },
        ],
      },
      {
        name: "source",
        label: "Source",
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
    ]);
    expect(results.html).toContain(
      '<nav class="facets" aria-label="Filters"><section class="facet"><h2>Type</h2><ul><li><a href="?type=keyword">Keyword <span class="count">1</span></a></li>',
    );
  });

  it("counts over the results of the query, not the whole site", async () => {
    const { results, view, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain('<p class="search-summary">2 results</p>');
    expect(
      view
        .props()
        .facets.map((facet) =>
          facet.values.map((value) => `${value.value}:${String(value.count)}`),
        ),
    ).toEqual([
      ["keyword:1", "term:1"],
      ["glossary:1", "specs:1"],
      ["publication:1"],
      ["concordance-cli:1"],
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
        facetLabel: "Type",
        label: "Term",
        href: "?q=key&source=specs",
      },
      {
        name: "source",
        value: "specs",
        facetLabel: "Source",
        label: "specs",
        href: "?q=key&type=term",
      },
    ]);
    expect(results.html).toContain('<p class="search-summary">No result</p>');
    expect(results.html).toContain('<ol class="results"></ol>');
  });

  it("intersects the facets: a type and a source keep the entities carrying both", async () => {
    const { results, view, follow, answer } = await resultsPage("?q=key");
    answer("ke", shards["ke"]);
    await settled();
    await follow("?q=key&source=specs");
    expect(results.html).toContain('<p class="search-summary">1 result</p>');
    expect(results.html).toContain("build summary");
    expect(results.html).not.toContain("Keyword page");
    await follow("?q=key&source=glossary,specs");
    expect(results.html).toContain('<p class="search-summary">2 results</p>');
    await follow("?q=key&type=term&source=glossary,specs");
    expect(results.html).toContain('<p class="search-summary">1 result</p>');
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
  it("lists a value nothing would come of with its count at 0, aria-disabled and no link", async () => {
    const { results, view, follow, location } = await resultsPage("");
    await follow("?type=keyword");
    expect(view.props().facets[2]).toEqual({
      name: "domain",
      label: "Domain",
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
      '<section class="facet"><h2>Domain</h2><ul><li><a class="facet-value" role="link" aria-disabled="true">Publication <span class="count">0</span></a></li></ul></section>',
    );
    expect(results.html).toContain(
      '<a href="?" class="facet-value" aria-current="true">Keyword <span class="count">1</span></a>',
    );
    expect(results.html).toContain('<li class="clear-filters"><a href="?">Clear filters</a></li>');
    expect(results.html).toContain(
      '<a href="?type=keyword,term">Term <span class="count">1</span></a>',
    );
    await follow("?");
    expect(location.pushed).toEqual(["?type=keyword", ""]);
    expect(results.html).toContain('<p class="search-summary">3 results</p>');
  });
});

describe("Active filters are recalled above the results and removable one by one", () => {
  it("draws every selected value with its facet, a link lifting it, and a link clearing them all", async () => {
    const { results, view, follow, location, input, answer } = await resultsPage(
      "?q=key&type=keyword,term&source=specs",
    );
    expect(input.value).toBe("key");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<ul class="active-filters" aria-label="Active filters"><li class="active-filter"><span class="facet-name">Type</span> Keyword <a href="?q=key&amp;type=term&amp;source=specs" class="remove-filter"><span aria-hidden="true">×</span><span class="visually-hidden">Remove this filter</span></a></li><li class="active-filter"><span class="facet-name">Type</span> Term <a href="?q=key&amp;type=keyword&amp;source=specs" class="remove-filter">',
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
      }),
    ).toEqual({
      query: "key",
      total: 0,
      results: [],
      facets: [],
    });
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
    expect(results.html).toContain('<p class="search-summary">1 result</p>');
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

describe("The current URL is visible in the interface, which makes the state explicit", () => {
  it("shows the address of the search from the root of the site under the summary, and follows every change", async () => {
    const { results, follow, input, view, answer } = await resultsPage("?q=key&type=term");
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<p class="search-address"><span class="visually-hidden">Address of this search</span><code class="search-url">search/index.html?q=key&amp;type=term</code></p>',
    );
    expect(results.html).not.toContain("copy-address");
    await follow("?type=term");
    expect(view.props().address).toBe("search/index.html?type=term");
    input.value = "";
    input.fire("input");
    await follow("?");
    expect(view.props().address).toBe("search/index.html");
  });

  it("offers a copy button when the page has a clipboard, and says so once the address is copied", async () => {
    const written: string[] = [];
    const { results, view, answer } = await resultsPage("?q=key", {
      clipboard: {
        writeText: (text) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });
    answer("ke", shards["ke"]);
    await settled();
    expect(results.html).toContain(
      '<code class="search-url">search/index.html?q=key</code><button type="button" class="copy-address">Copy</button><span class="copied" role="status"></span></p>',
    );
    view.props().onCopy?.();
    await settled();
    expect(written).toEqual(["file:///dist/search/index.html?q=key"]);
    expect(results.html).toContain('<span class="copied" role="status">Address copied</span>');
    expect(view.props().copied).toBe(true);
  });

  it("stays quiet when the clipboard refuses, and forgets the copy on the next change", async () => {
    const refusing = await resultsPage("", {
      clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    });
    refusing.view.props().onCopy?.();
    await settled();
    expect(refusing.view.props().copied).toBe(false);
    expect(refusing.results.html).toContain('<span class="copied" role="status"></span>');
    const accepting = await resultsPage("", { clipboard: { writeText: () => Promise.resolve() } });
    accepting.view.props().onCopy?.();
    await settled();
    expect(accepting.view.props().copied).toBe(true);
    await accepting.follow("?type=term");
    expect(accepting.view.props().copied).toBe(false);
    expect(accepting.results.html).toContain('<span class="copied" role="status"></span>');
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
    expect(results.html).toContain('<p class="search-summary">1 result</p>');
    input.value = "keyw";
    input.fire("input");
    expect(timers.pending).toHaveLength(1);
    location.pop("?q=key");
    await settled();
    expect(timers.pending).toEqual([]);
    expect(input.value).toBe("key");
    expect(view.props().active).toBeUndefined();
    expect(results.html).toContain('<p class="search-summary">2 results</p>');
    expect(scroll.scrolledTo).toEqual([200, 200]);
    expect(location.pushed).toEqual(["?q=key&type=term"]);
    location.pop("");
    await settled();
    expect(input.value).toBe("");
    expect(results.html).toContain('<p class="search-summary">3 results</p>');
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
