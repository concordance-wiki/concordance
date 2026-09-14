import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import type { ColourScheme } from "../../src/css/tokens.js";
import {
  applyChoice,
  displayedScheme,
  toggleChoice,
  wireModeSwitch,
  type ModeRoot,
  type ModeStorage,
  type ModeSwitchButton,
  type ModeSwitchElement,
  type SchemeView,
} from "../../src/islands/mode-switch.js";
import {
  MODE_SCRIPT,
  MODE_STORAGE_KEY,
  MODES,
  otherScheme,
  SCHEME_GLYPHS,
  switchGlyph,
} from "../../src/mode.js";
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
  click: () => void;
}

function button(withGlyph = true): FakeButton {
  const glyph = withGlyph ? { textContent: "" } : null;
  const fake: FakeButton = {
    hidden: true,
    attributes: {},
    listeners: [],
    glyph,
    setAttribute(name, value) {
      fake.attributes[name] = value;
    },
    addEventListener(_type, listener) {
      fake.listeners.push(listener);
    },
    querySelector: () => glyph,
    click: () => {
      for (const listener of fake.listeners) listener();
    },
  };
  return fake;
}

function element(target: ModeSwitchButton | null): ModeSwitchElement {
  return { querySelector: () => target };
}

/**
 * A page as the tokens layer displays it: the theme's default or the system preference while
 * the root carries no `data-mode`, the forced scheme otherwise; the preference can change.
 */
function page(
  root: ModeRoot,
  preference: ColourScheme,
): SchemeView & { prefer: (scheme: ColourScheme) => void } {
  let current = preference;
  const listeners: (() => void)[] = [];
  return {
    displayed: () => {
      const forced = root.dataset.mode;
      return forced === "dark" || forced === "light" ? forced : current;
    },
    onPreferenceChange: (listener) => {
      listeners.push(listener);
    },
    prefer: (scheme) => {
      current = scheme;
      for (const listener of listeners) listener();
    },
  };
}

describe("Light and dark modes: the toggle draws the scheme it switches to, follows the system preference and remembers a choice", () => {
  it("keeps the three choices a reader can hold, the two schemes and none", () => {
    expect(MODES).toEqual(["system", "light", "dark"]);
    expect(otherScheme("light")).toBe("dark");
    expect(otherScheme("dark")).toBe("light");
  });

  it("draws a moon over a light page and a sun over a dark one, the glyph of the scheme it switches to", () => {
    expect(SCHEME_GLYPHS).toEqual({ light: "☀", dark: "☾" });
    expect(switchGlyph("light")).toBe("☾");
    expect(switchGlyph("dark")).toBe("☀");
  });

  it("reads the scheme in force from the custom property of the root, light when it names none", () => {
    expect(displayedScheme(() => "dark")).toBe("dark");
    expect(displayedScheme(() => " dark ")).toBe("dark");
    expect(displayedScheme(() => "light")).toBe("light");
    expect(displayedScheme(() => "")).toBe("light");
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

  it("stores the other scheme when the page would not display it on its own, and nothing when the system already gives it", () => {
    const root: ModeRoot = { dataset: {} };
    expect(toggleChoice(page(root, "light"), root)).toBe("dark");
    root.dataset.mode = "dark";
    expect(toggleChoice(page(root, "light"), root)).toBe("system");
    root.dataset.mode = "light";
    expect(toggleChoice(page(root, "dark"), root)).toBe("system");
    expect(root.dataset.mode).toBeUndefined();
    expect(toggleChoice(page(root, "dark"), root)).toBe("light");
  });

  it("reveals the served button, presses it over a dark page and toggles the scheme, remembering the choice that departs from the system", () => {
    const target = button();
    const store = storage();
    const root: ModeRoot = { dataset: {} };
    const view = page(root, "light");
    expect(wireModeSwitch(element(target), store, root, view)).toBe(true);
    expect(target.hidden).toBe(false);
    expect(target.attributes["aria-pressed"]).toBe("false");
    expect(target.glyph?.textContent).toBe("☾");
    target.click();
    expect(root.dataset.mode).toBe("dark");
    expect(store.items.get(MODE_STORAGE_KEY)).toBe("dark");
    expect(target.attributes["aria-pressed"]).toBe("true");
    expect(target.glyph?.textContent).toBe("☀");
    target.click();
    expect(root.dataset.mode).toBeUndefined();
    expect(store.items.size).toBe(0);
    expect(target.attributes["aria-pressed"]).toBe("false");
    expect(target.glyph?.textContent).toBe("☾");
  });

  it("follows the system preference while no choice is stored, and stops following it once one is", () => {
    const target = button();
    const root: ModeRoot = { dataset: {} };
    const view = page(root, "light");
    wireModeSwitch(element(target), storage(), root, view);
    view.prefer("dark");
    expect(target.attributes["aria-pressed"]).toBe("true");
    expect(target.glyph?.textContent).toBe("☀");
    target.click();
    expect(root.dataset.mode).toBe("light");
    view.prefer("light");
    expect(target.attributes["aria-pressed"]).toBe("false");
    view.prefer("dark");
    expect(target.attributes["aria-pressed"]).toBe("false");
    expect(target.glyph?.textContent).toBe("☾");
  });

  it("starts from the scheme the page displays, a remembered dark choice included, and does without a glyph element", () => {
    const target = button(false);
    const root: ModeRoot = { dataset: { mode: "dark" } };
    expect(wireModeSwitch(element(target), broken, root, page(root, "light"))).toBe(true);
    expect(target.attributes["aria-pressed"]).toBe("true");
    target.click();
    expect(root.dataset.mode).toBeUndefined();
    expect(target.attributes["aria-pressed"]).toBe("false");
  });

  it("leaves an island without a button alone", () => {
    const root: ModeRoot = { dataset: {} };
    expect(wireModeSwitch(element(null), storage(), root, page(root, "light"))).toBe(false);
  });

  it("serves the switch hidden with its label serialised, a square drawing the moon, named for assistive technology alone", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      '<concordance-island data-island="mode-switch" data-props="{&quot;label&quot;:&quot;Dark mode&quot;}">',
    );
    expect(html).toContain(
      '<button type="button" class="mode-switch" aria-pressed="false" title="Dark mode" hidden><span class="mode-switch-glyph" aria-hidden="true">☾</span><span class="visually-hidden">Dark mode</span></button>',
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
