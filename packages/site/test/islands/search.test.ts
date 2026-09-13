import type { JSX } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import {
  isEditable,
  mountSearch,
  outcomeOf,
  searchRunner,
  shardLoader,
  SUGGESTIONS,
  wireShortcuts,
  type KeyEvent,
  type ScriptInjector,
  type SearchInput,
  type SearchIslandElement,
  type SearchIslands,
  type SearchPanel,
  type ShardHost,
} from "../../src/islands/search.js";
import type { SearchMeta, ShardData } from "../../src/search/shared.js";

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

describe("outcomeOf", () => {
  it("turns the ranked entities into results with the title, the type badge, the breadcrumb and the href from the page", () => {
    const loaded = new Map(Object.entries(shards));
    expect(outcomeOf("key", meta, loaded, "../")).toEqual({
      query: "key",
      results: [
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
      ],
    });
    expect(outcomeOf("search", meta, loaded, "").results).toEqual([
      {
        title: "Search results",
        href: "specs/screens/search-results/index.html",
        breadcrumb: ["Command line"],
      },
    ]);
  });

  it("leaves out an entity index the table does not have", () => {
    const loaded = new Map<string, ShardData>([["zz", { zzz: [[9, 5]] }]]);
    expect(outcomeOf("zzz", meta, loaded, "").results).toEqual([]);
  });
});

describe("searchRunner: the index is loaded in pieces as the user types", () => {
  it("loads the entity table once on the first query, then one shard per word, never twice", async () => {
    const { host, inject, injected, answer } = page();
    const run = searchRunner("../", inject, host);
    const warming = run("");
    expect(injected.map((script) => script.src)).toEqual(["../search/meta.js"]);
    answer("meta", meta);
    expect((await warming).results).toEqual([]);
    const first = run("Key");
    await Promise.resolve();
    expect(injected.map((script) => script.src)).toEqual(["../search/meta.js", "../search/ke.js"]);
    answer("ke", shards["ke"]);
    expect((await first).results.map((result) => result.title)).toEqual([
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
    expect((await second).results.map((result) => result.title)).toEqual(["Keyword page"]);
    const again = await run("keyword page");
    expect(again.results).toHaveLength(1);
    expect(injected).toHaveLength(3);
  });

  it("asks nothing for a word whose shard the table does not list, and matches nothing", async () => {
    const { host, inject, injected, answer } = page();
    const run = searchRunner("", inject, host);
    const running = run("zebra");
    answer("meta", meta);
    expect((await running).results).toEqual([]);
    expect(injected.map((script) => script.src)).toEqual(["search/meta.js"]);
  });

  it("treats a shard that fails to load as empty, and a table that fails as no index at all", async () => {
    const { host, inject, answer } = page();
    const run = searchRunner("", inject, host);
    const running = run("key");
    answer("meta", meta);
    await Promise.resolve();
    answer("ke");
    expect((await running).results).toEqual([]);
    const other = page();
    const failing = searchRunner("", other.inject, other.host)("key");
    other.answer("meta");
    expect(await failing).toEqual({ query: "key", results: [] });
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

function rendered(): { render: SearchIslands<Panel>["render"]; calls: number } {
  const state = {
    calls: 0,
    render: (vnode: JSX.Element, container: Panel) => {
      state.calls += 1;
      container.html = renderToString(vnode);
    },
  };
  return state;
}

const settled = async (): Promise<void> => {
  for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
};

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
      initialQuery: "",
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
      initialQuery: "",
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
      initialQuery: "keyword page",
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
    expect(results.html).toContain(
      '<p class="search-summary">1 results for <q>keyword page</q></p>',
    );
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
    expect(results.html).toContain("<q>search</q>");
    expect(results.html).toContain("Search results");
    expect(results.html).not.toContain("Keyword page");
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
      initialQuery: "",
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
    expect(results.html).toContain("<q>search</q>");
    expect(results.html).not.toContain("<q>key</q>");
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
      initialQuery: "key",
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
        initialQuery: "key",
        inject,
        host,
        render,
      }),
    ).toBe(1);
    expect(mountSearch({ islands: [], document, initialQuery: "", inject, host, render })).toBe(0);
    expect(results.html).toBe("");
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
      initialQuery: "",
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
        initialQuery: "",
        inject,
        host,
        render: rendered().render,
      }),
    ).toBe(1);
  });
});
