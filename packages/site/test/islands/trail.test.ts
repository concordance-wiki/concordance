// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/glossary/entity/index.html", "settings": { "disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "disableJavaScriptEvaluation": true, "handleDisabledFileLoadingAsSuccess": true } }
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendPage,
  carryTrail,
  condense,
  parseTrailHash,
  readTrail,
  resolveTrail,
  TRAIL_KEPT_MAX,
  TRAIL_SHOWN_MAX,
  TRAIL_STORAGE_KEY,
  TRAIL_GLYPH,
  trailHash,
  wireTrail,
  writeTrail,
  type TrailEnvironment,
  type TrailStorage,
} from "../../src/islands/trail.js";
import { header } from "../../src/gallery/fixtures.js";
import { renderPage, renderSlot } from "../../src/render.js";
import type { TrailPage, TrailProps } from "../../src/slots.js";
import { defaultTrailLabels, TRAIL_ISLAND } from "../../src/theme/default/trail.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { entityPage, footer } from "../../src/gallery/fixtures.js";

const labels = {
  title: "Trail",
  pin: "Pin",
  unpin: "Unpin",
  earlier: "earlier pages",
};

const source: TrailPage = { id: "glossary/source", title: "Source" };
const note: TrailPage = { id: "glossary/note", title: "Note" };
const entity: TrailPage = { id: "glossary/entity", title: "Entity" };

function storage(entries?: TrailPage[]): TrailStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  if (entries !== undefined) {
    items.set(TRAIL_STORAGE_KEY, JSON.stringify({ entries }));
  }
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const broken: TrailStorage = {
  getItem: () => {
    throw new Error("storage disabled");
  },
  setItem: () => {
    throw new Error("storage disabled");
  },
  removeItem: () => {
    throw new Error("storage disabled");
  },
};

interface Environment {
  env: TrailEnvironment & {
    local: ReturnType<typeof storage>;
    session: ReturnType<typeof storage>;
  };
  replaced: string[];
  /** The part of the page this environment hears the clicks of, so that tests do not hear one another. */
  container: HTMLElement;
}

interface Fixture extends Environment {
  host: HTMLElement;
}

interface FixtureOptions {
  hash?: string;
  href?: string;
  current?: TrailPage;
  base?: string;
  local?: TrailPage[];
  session?: TrailPage[];
  props?: string | null;
  history?: TrailEnvironment["history"];
}

/** A controlled location, history and storages around the test document. */
function environment(options: FixtureOptions = {}): Environment {
  const container = document.createElement("div");
  document.body.append(container);
  const replaced: string[] = [];
  const location = {
    href: options.href ?? `http://localhost/glossary/entity/index.html${options.hash ?? ""}`,
    hash: options.hash ?? "",
  };
  const env: Environment["env"] = {
    document: {
      createElement: (tag) => document.createElement(tag),
      addEventListener: (type, listener) => {
        container.addEventListener(type, listener);
      },
    },
    location,
    history: options.history ?? {
      replaceState: (_data: unknown, _unused: string, url: string) => {
        replaced.push(url);
        location.hash = url;
      },
    },
    local: storage(options.local),
    session: storage(options.session),
  };
  return { env, replaced, container };
}

/** An island element as the build writes it, in the test document. */
function fixture(options: FixtureOptions = {}): Fixture {
  const props: TrailProps = {
    base: options.base ?? "../../",
    labels,
    ...(options.current === undefined ? {} : { current: options.current }),
  };
  const host = document.createElement("concordance-island");
  host.setAttribute("data-island", TRAIL_ISLAND);
  const serialised = options.props === undefined ? JSON.stringify(props) : options.props;
  if (serialised !== null) {
    host.setAttribute("data-props", serialised);
  }
  const made = environment(options);
  made.container.append(host);
  return { ...made, host };
}

function wire(options: FixtureOptions = {}): Fixture {
  const made = fixture(options);
  expect(wireTrail(made.host, made.env)).toBe(true);
  return made;
}

const links = (host: Element, selector = ".trail > .trail-list > li > a"): [string, string][] =>
  [...host.querySelectorAll<HTMLAnchorElement>(selector)].map((anchor) => [
    anchor.getAttribute("href") ?? "",
    anchor.textContent,
  ]);

function pinButton(host: Element): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>("button.trail-pin");
  if (button === null) throw new Error("pin button: not found");
  return button;
}

function stored(store: TrailStorage): TrailPage[] | null {
  return readTrail(store)?.entries ?? null;
}

function pages(count: number, from = 1): TrailPage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `glossary/term-${String(index + from)}`,
    title: `Term ${String(index + from)}`,
  }));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("The trail shows the entities visited in order, each clickable", () => {
  it("lists the pages of the fragment in order, then the current page, each as a link to its page", () => {
    const { host } = wire({
      hash: trailHash([source.id, note.id]),
      session: [source, note],
      current: entity,
    });
    const nav = host.querySelector("nav.trail");
    expect(nav?.getAttribute("aria-label")).toBe("Trail");
    expect(links(host)).toEqual([
      ["../../glossary/source/index.html", "Source"],
      ["../../glossary/note/index.html", "Note"],
      ["../../glossary/entity/index.html", "Entity"],
    ]);
    expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe("Entity");
    expect(host.querySelector("details.trail-earlier")).toBeNull();
  });

  it("folds the trail behind a square button of the bar drawing a bookmark, named for assistive technology, the list unfolded under it", () => {
    const { host } = wire({ session: [source], current: entity });
    const fold = host.querySelector("details.trail-fold");
    expect(fold?.hasAttribute("open")).toBe(false);
    const button = fold?.querySelector(":scope > summary.trail-button");
    expect(button?.getAttribute("title")).toBe("Trail");
    expect(button?.innerHTML).toBe(`${TRAIL_GLYPH}<span class="visually-hidden">Trail</span>`);
    expect(fold?.querySelector(":scope > nav.trail > ol.trail-list")).not.toBeNull();
    expect(fold?.querySelector(":scope > nav.trail > button.trail-pin")).not.toBeNull();
  });

  it("deduplicates a page already at the end, as on a reload, and refreshes its title", () => {
    const { host, env } = wire({
      hash: trailHash([source.id, entity.id]),
      session: [source, { id: entity.id, title: "Old title" }],
      current: entity,
    });
    expect(links(host)).toEqual([
      ["../../glossary/source/index.html", "Source"],
      ["../../glossary/entity/index.html", "Entity"],
    ]);
    expect(stored(env.session)).toEqual([source, entity]);
    expect(appendPage([source, entity], entity)).toEqual([source, entity]);
    expect(appendPage([entity, source], entity)).toEqual([entity, source, entity]);
  });

  it("names a page it never saw by its identifier, and marks no current page on the home page", () => {
    const { host } = wire({ hash: trailHash([source.id, "glossary/alias"]), base: "" });
    expect(links(host)).toEqual([
      ["glossary/source/index.html", "glossary/source"],
      ["glossary/alias/index.html", "glossary/alias"],
    ]);
    expect(host.querySelector("[aria-current]")).toBeNull();
  });

  it("leaves the island empty, so that the bar shows no button, when the trail is empty", () => {
    const { host, env, replaced } = wire();
    expect(host.childNodes).toHaveLength(0);
    expect(replaced).toEqual([]);
    expect(env.session.items.size).toBe(0);
  });

  it("serves the island empty in the bar, before the mode switch, its labels and the current page serialised, so that without JavaScript the bar shows no button", () => {
    const html = renderSlot(
      "Header",
      { ...header, trail: { base: "../", labels, current: entity } },
      defaultTheme,
    );
    expect(html).toContain(
      '</details><concordance-island data-island="trail" data-props="{&quot;base&quot;:&quot;../&quot;,&quot;labels&quot;:{&quot;title&quot;:&quot;Trail&quot;,&quot;pin&quot;:&quot;Pin&quot;,&quot;unpin&quot;:&quot;Unpin&quot;,&quot;earlier&quot;:&quot;earlier pages&quot;},&quot;current&quot;:{&quot;id&quot;:&quot;glossary/entity&quot;,&quot;title&quot;:&quot;Entity&quot;}}"></concordance-island><concordance-island data-island="mode-switch"',
    );
    expect(html).not.toContain("trail-list");
    expect(html).toContain("</concordance-island></nav></header>");
  });

  it("renders the island with the theme's own labels and no current page when the header receives no trail", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      `<concordance-island data-island="trail" data-props="${JSON.stringify({ base: "", labels: defaultTrailLabels }).replaceAll('"', "&quot;")}"></concordance-island>`,
    );
    expect(defaultTrailLabels).toEqual(labels);
  });

  it("leaves an island without props alone", () => {
    const { host, env } = fixture({ props: null });
    expect(wireTrail(host, env)).toBe(false);
    expect(host.childNodes).toHaveLength(0);
  });
});

describe("The trail is encoded in the URL, hence shareable and restored on reload", () => {
  it("writes the trail in the fragment with history.replaceState, each identifier encoded", () => {
    const { env, replaced } = wire({ session: [source], current: entity });
    expect(replaced).toEqual(["#trail=glossary%2Fsource,glossary%2Fentity"]);
    expect(env.location.hash).toBe("#trail=glossary%2Fsource,glossary%2Fentity");
    expect(trailHash(["a/b", "c,d"])).toBe("#trail=a%2Fb,c%2Cd");
  });

  it("restores the trail from the fragment before anything stored, so that a shared link shows the same trail", () => {
    const { host, replaced } = wire({
      hash: trailHash([note.id]),
      session: [note, source],
      local: [source],
      current: entity,
    });
    expect(links(host).map(([, title]) => title)).toEqual(["Note", "Entity"]);
    expect(replaced).toEqual(["#trail=glossary%2Fnote,glossary%2Fentity"]);
  });

  it("does not rewrite the fragment when it already holds the trail", () => {
    const hash = trailHash([source.id, entity.id]);
    const { replaced } = wire({ hash, session: [source, entity], current: entity });
    expect(replaced).toEqual([]);
  });

  it("reads the fragment leniently: no trail without the parameter, unreadable escapes and empty entries skipped", () => {
    expect(parseTrailHash("")).toBeNull();
    expect(parseTrailHash("#L12")).toBeNull();
    expect(parseTrailHash("#trails=a")).toBeNull();
    expect(parseTrailHash("#trail=")).toEqual([]);
    expect(parseTrailHash("trail=a%2Fb,,%E0%A4%A,c")).toEqual(["a/b", "c"]);
  });

  it("makes every internal link of the page carry the trail when it is followed", () => {
    const { env, container } = wire({ session: [source], current: entity });
    const page = document.createElement("main");
    page.innerHTML = [
      '<a id="internal" href="../note/index.html"><span>Note</span></a>',
      '<a id="root" href="../../index.html">Home</a>',
      '<a id="passage" href="../source/index.html#L12">line 12</a>',
      '<a id="skip" href="#main">Skip</a>',
      '<a id="external" href="https://example.org/">Elsewhere</a>',
      '<a id="download" href="../../model.json" download>Model</a>',
      '<button id="button">Not a link</button>',
    ].join("");
    container.append(page);
    for (const anchor of page.querySelectorAll("a")) {
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
      });
    }
    const click = (id: string): void => {
      const target = document.getElementById(id);
      if (target === null) throw new Error(`${id}: not found`);
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    };
    const span = page.querySelector("#internal span");
    span?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    for (const id of ["root", "passage", "skip", "external", "download", "button"]) click(id);
    const text = page.querySelector("#root")?.firstChild;
    text?.dispatchEvent(new Event("click", { bubbles: true }));
    container.dispatchEvent(new Event("click"));
    const hrefs = [...page.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));
    expect(hrefs).toEqual([
      `../note/index.html${env.location.hash}`,
      `../../index.html${env.location.hash}`,
      "../source/index.html#L12",
      "#main",
      "https://example.org/",
      "../../model.json",
    ]);
  });

  it("carries the trail over file://, where the host is empty, and ignores a link it cannot resolve", () => {
    const location = { href: "file:///Users/reader/site/glossary/entity/index.html", hash: "" };
    const attributes = new Map<string, string>([["href", "../note/index.html#"]]);
    const anchor = {
      href: "file:///Users/reader/site/glossary/note/index.html",
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attributes.set(name, value);
      },
      hasAttribute: (name: string) => attributes.has(name),
    };
    expect(carryTrail(anchor, "#trail=a", location)).toBe(true);
    expect(attributes.get("href")).toBe("../note/index.html#trail=a");
    expect(carryTrail({ ...anchor, href: "not a url" }, "#trail=a", location)).toBe(false);
    attributes.delete("href");
    expect(carryTrail({ ...anchor, href: "file:///elsewhere.html" }, "#trail=b", location)).toBe(
      true,
    );
    expect(attributes.get("href")).toBe("#trail=b");
  });

  it("leaves a fragment that targets a passage alone: the tab's storage carries the trail instead", () => {
    const { host, replaced, env } = wire({
      hash: "#L12",
      href: "http://localhost/glossary/entity/index.html#L12",
      session: [source],
      current: entity,
    });
    expect(replaced).toEqual([]);
    expect(env.location.hash).toBe("#L12");
    expect(links(host).map(([, title]) => title)).toEqual(["Source", "Entity"]);
    expect(stored(env.session)).toEqual([source, entity]);
  });

  it("keeps the trail in the tab when history refuses the fragment", () => {
    const { host } = wire({
      session: [source],
      current: entity,
      history: {
        replaceState: () => {
          throw new Error("refused");
        },
      },
    });
    expect(links(host).map(([, title]) => title)).toEqual(["Source", "Entity"]);
  });
});

describe("A pinned trail is kept locally between visits", () => {
  it("stores the trail under concordance-trail when pinned, presses the button and names the reverse action", () => {
    const { host, env } = wire({ session: [source], current: entity });
    const button = pinButton(host);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("Pin");
    expect(button.getAttribute("type")).toBe("button");
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toBe("Unpin");
    expect(env.local.items.get("concordance-trail")).toBe(
      JSON.stringify({ entries: [source, entity] }),
    );
  });

  it("restores the pinned trail on a page without a fragment trail nor a tab trail, and keeps storing its growth", () => {
    const { host, env } = wire({ local: [source, note], current: entity });
    expect(links(host).map(([, title]) => title)).toEqual(["Source", "Note", "Entity"]);
    expect(pinButton(host).getAttribute("aria-pressed")).toBe("true");
    expect(stored(env.local)).toEqual([source, note, entity]);
    expect(stored(env.session)).toEqual([source, note, entity]);
  });

  it("prefers the tab's own trail to the pinned one, which then stays as it is", () => {
    const { host, env } = wire({ local: [source, note], session: [note], current: entity });
    expect(links(host).map(([, title]) => title)).toEqual(["Note", "Entity"]);
    expect(pinButton(host).getAttribute("aria-pressed")).toBe("false");
    expect(stored(env.local)).toEqual([source, note]);
  });

  it("does not press the button for a shared trail that differs from the pinned one, and does not overwrite it", () => {
    const { host, env } = wire({
      hash: trailHash([note.id]),
      local: [source, note],
      current: entity,
    });
    expect(pinButton(host).getAttribute("aria-pressed")).toBe("false");
    expect(stored(env.local)).toEqual([source, note]);
  });

  it("unpins by clearing the storage, so that the next visit starts empty", () => {
    const { host, env } = wire({ local: [source], current: entity });
    const button = pinButton(host);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("Pin");
    expect(env.local.items.size).toBe(0);
    const next = wire({ current: note, local: [] });
    expect(next.env.local.items.size).toBe(1);
    expect(links(next.host).map(([, title]) => title)).toEqual(["Note"]);
  });

  it("treats an unreadable or malformed storage as empty and survives a storage that refuses to write", () => {
    expect(readTrail(broken)).toBeNull();
    for (const raw of ["not json", "null", "5", "{}", '{"entries":{}}', '{"entries":[{"id":1}]}']) {
      const store = storage();
      store.items.set(TRAIL_STORAGE_KEY, raw);
      expect(readTrail(store), raw).toBeNull();
    }
    expect(() => {
      writeTrail(broken, [source]);
      writeTrail(broken, null);
    }).not.toThrow();
    const { host, env } = fixture({ current: entity });
    expect(wireTrail(host, { ...env, local: broken, session: broken })).toBe(true);
  });

  it("takes titles from both storages, the tab's winning, and falls back in order: fragment, tab, pinned, empty", () => {
    const pinned = { entries: [{ id: source.id, title: "Pinned source" }, note] };
    const session = { entries: [source] };
    expect(resolveTrail(trailHash([source.id, note.id]), session, pinned, entity)).toEqual({
      entries: [source, note, entity],
      pinned: true,
    });
    expect(resolveTrail("", session, pinned, undefined)).toEqual({
      entries: [source],
      pinned: false,
    });
    expect(resolveTrail("", null, pinned, undefined)).toEqual({
      entries: pinned.entries,
      pinned: true,
    });
    expect(resolveTrail("", null, null, entity)).toEqual({ entries: [entity], pinned: false });
    expect(resolveTrail("", null, null, undefined)).toEqual({ entries: [], pinned: false });
  });
});

describe("The trail is bounded in length, the oldest entries being condensed", () => {
  it("shows twelve entries at most: with thirteen, the two oldest fold into one expandable entry", () => {
    expect(TRAIL_SHOWN_MAX).toBe(12);
    const visited = pages(12);
    const current = { id: "glossary/term-13", title: "Term 13" };
    const { host } = wire({ session: visited, current });
    const items = host.querySelectorAll(".trail > .trail-list > li");
    expect(items).toHaveLength(12);
    const details = items[0]?.querySelector("details.trail-earlier");
    expect(details?.querySelector("summary")?.textContent).toBe("… 2 earlier pages");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(
      links(host, "details.trail-earlier .trail-list > li > a").map(([, title]) => title),
    ).toEqual(["Term 1", "Term 2"]);
    expect(links(host, ".trail > .trail-list > li > a").map(([, title]) => title)).toEqual(
      visited
        .slice(2)
        .map((page) => page.title)
        .concat("Term 13"),
    );
    expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe("Term 13");
  });

  it("folds nineteen of thirty entries, every one of them still a link in order", () => {
    const visited = pages(29);
    const current = { id: "glossary/term-30", title: "Term 30" };
    const { host } = wire({ session: visited, current });
    expect(host.querySelectorAll(".trail > .trail-list > li")).toHaveLength(12);
    expect(host.querySelector("details.trail-earlier > summary")?.textContent).toBe(
      "… 19 earlier pages",
    );
    expect(links(host, "details.trail-earlier .trail-list > li > a")).toEqual(
      visited.slice(0, 19).map((page) => [`../../${page.id}/index.html`, page.title]),
    );
    expect(condense(visited, 12)).toEqual({
      earlier: visited.slice(0, 18),
      shown: visited.slice(18),
    });
    expect(condense(pages(12))).toEqual({ earlier: [], shown: pages(12) });
  });

  it("keeps fifty entries at most, dropping the oldest beyond, so that the URL stays short", () => {
    expect(TRAIL_KEPT_MAX).toBe(50);
    const visited = pages(60);
    const current = { id: "glossary/term-61", title: "Term 61" };
    const { env } = wire({ session: visited, current });
    const kept = stored(env.session) ?? [];
    expect(kept).toHaveLength(50);
    expect(kept[0]).toEqual({ id: "glossary/term-12", title: "Term 12" });
    expect(kept[49]).toEqual(current);
    expect(env.location.hash.split(",")).toHaveLength(50);
  });
});

describe("the trail entry", () => {
  it("wires every trail island of the document with the storages, the location and the history of the page", async () => {
    const props: TrailProps = { base: "../../", labels, current: entity };
    document.body.innerHTML = `<concordance-island data-island="trail" data-props='${JSON.stringify(props)}'></concordance-island>`;
    sessionStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify({ entries: [source] }));
    await import("../../src/islands/trail.client.js");
    expect(links(document.body)).toEqual([
      ["../../glossary/source/index.html", "Source"],
      ["../../glossary/entity/index.html", "Entity"],
    ]);
    expect(location.hash).toBe("#trail=glossary%2Fsource,glossary%2Fentity");
    expect(sessionStorage.getItem(TRAIL_STORAGE_KEY)).toBe(
      JSON.stringify({ entries: [source, entity] }),
    );
    expect(localStorage.getItem(TRAIL_STORAGE_KEY)).toBeNull();
    sessionStorage.clear();
    history.replaceState(null, "", "#");
  });
});

describe("the trail passes the accessibility audit once rendered", () => {
  it("finds no violation on an entity page whose trail lists thirteen pages", async () => {
    const html = renderPage("EntityPage", entityPage, {
      theme: defaultTheme,
      locale: "en",
      title: "Entity",
      stylesheets: [],
      islands: [
        { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
        { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
        { name: "search", file: "search-00000000.js", bytes: 0 },
        { name: "toc", file: "toc-00000000.js", bytes: 0 },
        { name: "trail", file: "trail-00000000.js", bytes: 0 },
      ],
      header: { ...header, trail: { base: "../../", labels, current: entity } },
      footer,
    });
    const parsed = new DOMParser().parseFromString(html, "text/html").documentElement;
    const root = document.documentElement;
    for (const { name } of [...root.attributes]) root.removeAttribute(name);
    for (const { name, value } of [...parsed.attributes]) root.setAttribute(name, value);
    root.innerHTML = parsed.innerHTML;
    const island = document.querySelector(`concordance-island[data-island="${TRAIL_ISLAND}"]`);
    if (island === null) throw new Error("trail island: not found");
    const { env } = environment({ session: pages(12), current: entity });
    expect(wireTrail(island, env)).toBe(true);
    expect(document.querySelectorAll("nav.trail")).toHaveLength(1);
    const results = await axe.run(document, {
      resultTypes: ["violations"],
      rules: {
        "color-contrast": { enabled: false },
        "color-contrast-enhanced": { enabled: false },
        "link-in-text-block": { enabled: false },
      },
    });
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(" | ")}`,
      ),
    ).toEqual([]);
  });
});
