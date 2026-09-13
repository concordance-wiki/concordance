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
