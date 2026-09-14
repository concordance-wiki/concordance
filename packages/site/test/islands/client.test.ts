import { afterEach, describe, expect, it, vi } from "vitest";

describe("the mentions-panel hydration entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("looks for the islands of the mentions panel in the document as soon as it loads", async () => {
    const selectors: string[] = [];
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [];
      },
    });
    await import("../../src/islands/mentions-panel.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="mentions-panel"]']);
  });
});

describe("the contract-viewer hydration entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("looks for the islands of the contract viewer in the document as soon as it loads", async () => {
    const selectors: string[] = [];
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [];
      },
    });
    await import("../../src/islands/contract-viewer.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="contract-viewer"]']);
  });
});

describe("the mode-switch entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wires every mode switch of the document with the local storage, the root element and the scheme the tokens layer displays", async () => {
    const selectors: string[] = [];
    const buttons: { hidden: boolean; attributes: Record<string, string>; text: string }[] = [];
    const queries: string[] = [];
    const island = () => {
      const button = { hidden: true, attributes: {} as Record<string, string>, text: "" };
      buttons.push(button);
      return {
        querySelector: () => ({
          get hidden() {
            return button.hidden;
          },
          set hidden(value: boolean) {
            button.hidden = value;
          },
          setAttribute: (name: string, value: string) => {
            button.attributes[name] = value;
          },
          addEventListener: () => undefined,
          querySelector: () => ({
            get textContent() {
              return button.text;
            },
            set textContent(value: string | null) {
              button.text = value ?? "";
            },
          }),
        }),
      };
    };
    const documentElement = { dataset: {} };
    vi.stubGlobal("document", {
      documentElement,
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [island(), island()];
      },
    });
    vi.stubGlobal("localStorage", {
      getItem: () => "dark",
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("getComputedStyle", (element: unknown) => ({
      getPropertyValue: (property: string) => {
        expect(element).toBe(documentElement);
        return property === "--scheme" ? " dark" : "";
      },
    }));
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: (type: string) => {
        queries.push(`${query} ${type}`);
      },
    }));
    await import("../../src/islands/mode-switch.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="mode-switch"]']);
    expect(queries).toEqual([
      "(prefers-color-scheme: dark) change",
      "(prefers-color-scheme: dark) change",
    ]);
    expect(buttons).toEqual([
      { hidden: false, attributes: { "aria-pressed": "true" }, text: "☀" },
      { hidden: false, attributes: { "aria-pressed": "true" }, text: "☀" },
    ]);
  });
});

describe("the toc entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** A document holding one table of contents whose two sections exist, recording what the entry observes. */
  function fakeDocument(): {
    selectors: string[];
    observed: string[];
    links: { attributes: Map<string, string> }[];
  } {
    const selectors: string[] = [];
    const observed: string[] = [];
    const links = ["#scope", "#history"].map((href) => {
      const attributes = new Map([["href", href]]);
      return {
        attributes,
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
          attributes.set(name, value);
        },
        removeAttribute: (name: string) => {
          attributes.delete(name);
        },
      };
    });
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [{ querySelectorAll: () => links }];
      },
      getElementById: (id: string) => ({ id }),
    });
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          private readonly callback: (
            entries: { target: { id: string }; isIntersecting: boolean }[],
          ) => void,
          public readonly options: { rootMargin: string },
        ) {}
        observe(target: { id: string }): void {
          observed.push(`${target.id} in ${this.options.rootMargin}`);
          this.callback([{ target, isIntersecting: target.id === "history" }]);
        }
      },
    );
    return { selectors, observed, links };
  }

  it("wires every table of contents of the document with an intersection observer over the top third of the viewport", async () => {
    const { selectors, observed, links } = fakeDocument();
    await import("../../src/islands/toc.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="toc"]']);
    expect(observed).toEqual(["scope in 0px 0px -66% 0px", "history in 0px 0px -66% 0px"]);
    expect(links.map((entry) => entry.attributes.get("aria-current"))).toEqual([
      undefined,
      "location",
    ]);
  });

  it("leaves the served mark alone in a browser without an intersection observer", async () => {
    const { observed, links } = fakeDocument();
    vi.stubGlobal("IntersectionObserver", undefined);
    await import("../../src/islands/toc.client.js");
    expect(observed).toEqual([]);
    expect(links.map((entry) => entry.attributes.get("aria-current"))).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe("the search entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  interface FakeScript {
    src: string;
    listeners: Record<string, (() => void)[]>;
    addEventListener(type: string, listener: () => void): void;
  }

  /** A page holding the header field of an entity page; the scripts it receives are recorded, not run. */
  function fakePage(search: string): {
    scripts: FakeScript[];
    input: { value: string; focused: boolean; listeners: Record<string, (() => void)[]> };
    selectors: string[];
    keydown: ((event: unknown) => void)[];
  } {
    const scripts: FakeScript[] = [];
    const selectors: string[] = [];
    const keydown: ((event: unknown) => void)[] = [];
    const input = {
      value: "",
      focused: false,
      listeners: {} as Record<string, (() => void)[]>,
      focus() {
        input.focused = true;
      },
      blur() {
        input.focused = false;
      },
      addEventListener(type: string, listener: () => void) {
        (input.listeners[type] ??= []).push(listener);
      },
    };
    const panel = { hidden: true, addEventListener: () => undefined };
    const clear = { hidden: true, addEventListener: () => undefined };
    const element = {
      getAttribute: () =>
        JSON.stringify({
          root: "../../",
          search: { action: "../../search/index.html", placeholder: "Search" },
        }),
      querySelector: (selector: string) =>
        selector === "input" ? input : selector === ".search-clear" ? clear : panel,
      querySelectorAll: () => [],
    };
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [element];
      },
      addEventListener: (_type: string, listener: (event: unknown) => void) => {
        keydown.push(listener);
      },
      createElement: () => {
        const script: FakeScript = {
          src: "",
          listeners: {},
          addEventListener(type, listener) {
            (script.listeners[type] ??= []).push(listener);
          },
        };
        return script;
      },
      head: {
        appendChild: (script: FakeScript) => {
          scripts.push(script);
        },
      },
    });
    vi.stubGlobal("location", { search });
    vi.stubGlobal("window", {});
    return { scripts, input, selectors, keydown };
  }

  it("injects the entity table as a classic script under search/ when the field takes focus, so that a file:// page loads it, and receives the callback", async () => {
    const { scripts, input, selectors } = fakePage("?q=keyword");
    await import("../../src/islands/search.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="search"]']);
    expect(scripts).toEqual([]);
    for (const listener of input.listeners["focus"] ?? []) listener();
    expect(scripts.map((script) => script.src)).toEqual(["../../search/meta.js"]);
    const receiver = (
      window as { __concordanceSearch?: { shard(name: string, data: unknown): void } }
    ).__concordanceSearch;
    expect(receiver).toBeDefined();
    receiver?.shard("meta", {
      entities: [],
      shards: [],
      types: {},
      applications: {},
      domains: {},
      bytes: 0,
    });
    for (const listener of scripts[0]?.listeners["load"] ?? []) listener();
    for (const listener of input.listeners["focus"] ?? []) listener();
    expect(scripts).toHaveLength(1);
    expect(input.value).toBe("");
  });

  it("tells the loader when a script fails, and reads no query from an address without one", async () => {
    const { scripts, input, keydown } = fakePage("");
    await import("../../src/islands/search.client.js");
    for (const listener of input.listeners["focus"] ?? []) listener();
    for (const listener of scripts[0]?.listeners["error"] ?? []) listener();
    expect(scripts).toHaveLength(1);
    for (const listener of keydown) {
      listener({
        key: "/",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target: null,
        preventDefault: () => undefined,
      });
    }
    expect(input.focused).toBe(true);
  });
});

describe("the panels entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("wires every panels island of the document with the local storage and the root element, revealing the handles", async () => {
    const selectors: string[] = [];
    const handle = {
      hidden: true,
      attributes: { "data-panel": "tree" } as Record<string, string>,
      getAttribute: (name: string) => handle.attributes[name] ?? null,
      setAttribute: (name: string, value: string) => {
        handle.attributes[name] = value;
      },
      addEventListener: () => undefined,
      querySelector: () => null,
    };
    const root = { dataset: {} as { panels?: string } };
    vi.stubGlobal("document", {
      documentElement: root,
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return selector === ".panel-handle" ? [handle] : [{ getAttribute: () => "{}" }];
      },
      addEventListener: () => undefined,
    });
    vi.stubGlobal("localStorage", {
      getItem: () => "tree",
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await import("../../src/islands/panels.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="panels"]', ".panel-handle"]);
    expect(handle.hidden).toBe(false);
    expect(handle.attributes["aria-expanded"]).toBe("false");
  });
});

describe("the pins entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("wires every pins island of the document with the local storage and the window, drawing the stored pins", async () => {
    const selectors: string[] = [];
    let drawn = "";
    const island = {
      firstElementChild: null,
      getAttribute: () =>
        JSON.stringify({
          base: "../",
          labels: {
            pin: "Pin",
            pinned: "Pinned",
            label: "Pinned",
            pages: "Pinned pages",
            countOne: "{count} pinned",
            countMany: "{count} pinned",
            unpin: "Unpin {title}",
            all: "All pinned",
            filter: "Filter",
            removeAll: "Remove all",
            confirmRemoveAll: "Remove every pinned page?",
          },
        }),
      set innerHTML(value: string) {
        drawn = value;
      },
      querySelector: () => null,
      addEventListener: () => undefined,
    };
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [island];
      },
      querySelector: () => null,
    });
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ entries: [{ id: "glossary/source", title: "Source" }] }),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("window", { addEventListener: () => undefined, confirm: () => false });
    await import("../../src/islands/pins.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="pins"]']);
    expect(drawn).toContain('<nav class="pins" aria-label="Pinned pages">');
    expect(drawn).toContain('<a href="../glossary/source/index.html">Source</a>');
  });
});
