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

  it("wires every mode switch of the document with the local storage and the root element", async () => {
    const selectors: string[] = [];
    const buttons: { hidden: boolean; attributes: Record<string, string>; text: string }[] = [];
    const island = () => {
      const button = { hidden: true, attributes: {} as Record<string, string>, text: "" };
      buttons.push(button);
      return {
        getAttribute: () =>
          JSON.stringify({ labels: { system: "auto", light: "clair", dark: "sombre" } }),
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
    vi.stubGlobal("document", {
      documentElement: { dataset: {} },
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
    await import("../../src/islands/mode-switch.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="mode-switch"]']);
    expect(buttons).toEqual([
      { hidden: false, attributes: { "aria-pressed": "true" }, text: "sombre" },
      { hidden: false, attributes: { "aria-pressed": "true" }, text: "sombre" },
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
    const element = {
      getAttribute: () =>
        JSON.stringify({
          root: "../../",
          search: { action: "../../search/index.html", placeholder: "Search" },
        }),
      querySelector: (selector: string) => (selector === "input" ? input : panel),
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
