import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import {
  applyChoice,
  nextChoice,
  readChoice,
  wireModeSwitch,
  type ModeRoot,
  type ModeStorage,
  type ModeSwitchButton,
  type ModeSwitchElement,
} from "../../src/islands/mode-switch.js";
import { MODE_GLYPHS, MODE_SCRIPT, MODE_STORAGE_KEY, MODES } from "../../src/mode.js";
import { componentsStylesheet } from "../../src/css/stylesheet.js";
import { renderSlot } from "../../src/render.js";
import { header } from "../../src/gallery/fixtures.js";
import { defaultTheme } from "../../src/theme/resolve.js";

function storage(
  initial: Record<string, string> = {},
): ModeStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
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

const broken: ModeStorage = {
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

interface FakeButton extends ModeSwitchButton {
  attributes: Record<string, string>;
  listeners: (() => void)[];
  glyph: { textContent: string | null } | null;
  text: { textContent: string | null } | null;
  click: () => void;
}

function button(withText = true): FakeButton {
  const glyph = withText ? { textContent: "" } : null;
  const text = withText ? { textContent: "" } : null;
  const fake: FakeButton = {
    hidden: true,
    attributes: {},
    listeners: [],
    glyph,
    text,
    setAttribute(name, value) {
      fake.attributes[name] = value;
    },
    addEventListener(_type, listener) {
      fake.listeners.push(listener);
    },
    querySelector: (selector) => (selector === ".mode-switch-glyph" ? glyph : text),
    click: () => {
      for (const listener of fake.listeners) listener();
    },
  };
  return fake;
}

function element(
  target: ModeSwitchButton | null,
  props: string | null = JSON.stringify({
    name: "Colour scheme",
    labels: { system: "automatic", light: "light", dark: "dark" },
  }),
): ModeSwitchElement {
  return { getAttribute: () => props, querySelector: () => target };
}

describe("Light and dark modes, following the system preference and remembered", () => {
  it("cycles through automatic, light and dark, in that order", () => {
    expect(MODES).toEqual(["system", "light", "dark"]);
    expect(nextChoice("system")).toBe("light");
    expect(nextChoice("light")).toBe("dark");
    expect(nextChoice("dark")).toBe("system");
  });

  it("reads a stored light or dark choice and treats anything else, or an unreadable storage, as automatic", () => {
    expect(readChoice(storage({ [MODE_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(readChoice(storage({ [MODE_STORAGE_KEY]: "light" }))).toBe("light");
    expect(readChoice(storage({ [MODE_STORAGE_KEY]: "sepia" }))).toBe("system");
    expect(readChoice(storage())).toBe("system");
    expect(readChoice(broken)).toBe("system");
  });

  it("applies a choice to data-mode on the root and remembers it under the namespaced key", () => {
    const store = storage();
    const root: ModeRoot = { dataset: {} };
    applyChoice("dark", store, root);
    expect(root.dataset.mode).toBe("dark");
    expect(store.items.get("concordance-mode")).toBe("dark");
    applyChoice("system", store, root);
    expect(root.dataset).toEqual({});
    expect(store.items.size).toBe(0);
  });

  it("still changes the page when storage refuses to remember", () => {
    const root: ModeRoot = { dataset: { mode: "dark" } };
    applyChoice("light", broken, root);
    expect(root.dataset.mode).toBe("light");
    applyChoice("system", broken, root);
    expect(root.dataset.mode).toBeUndefined();
  });

  it("draws a half disc for the system preference, a sun for light and a moon for dark", () => {
    expect(MODE_GLYPHS).toEqual({ system: "◐", light: "☀", dark: "☾" });
  });

  it("reveals the served button, draws and names the current choice and presses it only when a scheme is forced", () => {
    const target = button();
    const store = storage();
    const root: ModeRoot = { dataset: {} };
    expect(wireModeSwitch(element(target), store, root)).toBe(true);
    expect(target.hidden).toBe(false);
    expect(target.attributes["aria-pressed"]).toBe("false");
    expect(target.attributes["aria-label"]).toBe("Colour scheme: automatic");
    expect(target.attributes["title"]).toBe("Colour scheme: automatic");
    expect(target.glyph?.textContent).toBe("◐");
    expect(target.text?.textContent).toBe("automatic");
    target.click();
    expect(root.dataset.mode).toBe("light");
    expect(target.attributes["aria-pressed"]).toBe("true");
    expect(target.attributes["aria-label"]).toBe("Colour scheme: light");
    expect(target.glyph?.textContent).toBe("☀");
    expect(target.text?.textContent).toBe("light");
    target.click();
    expect(root.dataset.mode).toBe("dark");
    expect(target.attributes["title"]).toBe("Colour scheme: dark");
    expect(target.glyph?.textContent).toBe("☾");
    expect(target.text?.textContent).toBe("dark");
    expect(store.items.get(MODE_STORAGE_KEY)).toBe("dark");
    target.click();
    expect(root.dataset.mode).toBeUndefined();
    expect(target.attributes["aria-pressed"]).toBe("false");
    expect(target.glyph?.textContent).toBe("◐");
    expect(target.text?.textContent).toBe("automatic");
  });

  it("starts from the remembered choice and falls back to the mode name without labels, glyph or value element", () => {
    const target = button(false);
    expect(
      wireModeSwitch(element(target, null), storage({ [MODE_STORAGE_KEY]: "dark" }), {
        dataset: {},
      }),
    ).toBe(true);
    expect(target.attributes["aria-pressed"]).toBe("true");
    expect(target.attributes["aria-label"]).toBe(": dark");
    const labelled = button();
    wireModeSwitch(element(labelled, "{}"), storage({ [MODE_STORAGE_KEY]: "dark" }), {
      dataset: {},
    });
    expect(labelled.glyph?.textContent).toBe("☾");
    expect(labelled.text?.textContent).toBe("dark");
  });

  it("leaves an island without a button alone", () => {
    expect(wireModeSwitch(element(null), storage(), { dataset: {} })).toBe(false);
  });

  it("serves the switch hidden with its labels serialised, a square drawing the glyph, its name and the choice written for assistive technology alone", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      '<concordance-island data-island="mode-switch" data-props="{&quot;name&quot;:&quot;Colour scheme&quot;,&quot;labels&quot;:{&quot;system&quot;:&quot;automatic&quot;,&quot;light&quot;:&quot;light&quot;,&quot;dark&quot;:&quot;dark&quot;}}">',
    );
    expect(html).toContain(
      '<button type="button" class="mode-switch" aria-pressed="false" aria-label="Colour scheme: automatic" title="Colour scheme: automatic" hidden><span class="mode-switch-glyph" aria-hidden="true">◐</span><span class="visually-hidden"><span class="mode-switch-label">Colour scheme</span> <span class="mode-switch-value">automatic</span></span></button>',
    );
    const css = componentsStylesheet();
    expect(css).toContain(
      ".mode-switch {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  justify-content: center;\n  inline-size: 2.5rem;\n  block-size: 2.5rem;\n  padding: 0;\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius);",
    );
  });

  it("keeps the inline script under 300 bytes, reading only the stored choice before the first paint", () => {
    expect(Buffer.byteLength(MODE_SCRIPT)).toBeLessThan(300);
    expect(MODE_SCRIPT).toContain(`localStorage.getItem("${MODE_STORAGE_KEY}")`);
    expect(MODE_SCRIPT).toContain("document.documentElement.dataset.mode=m");
    expect(MODE_SCRIPT).toContain('m==="light"||m==="dark"');
    expect(MODE_SCRIPT).not.toContain("<");
    const root = { dataset: {} as { mode?: string } };
    const run = (localStorage: Pick<ModeStorage, "getItem">, dataset = root.dataset): void => {
      runInNewContext(MODE_SCRIPT, { localStorage, document: { documentElement: { dataset } } });
    };
    run({ getItem: () => "dark" });
    expect(root.dataset.mode).toBe("dark");
    run({ getItem: () => "sepia" }, {});
    expect(root.dataset.mode).toBe("dark");
    const untouched: { mode?: string } = {};
    expect(() => {
      run(broken, untouched);
    }).not.toThrow();
    expect(untouched).toEqual({});
  });
});
