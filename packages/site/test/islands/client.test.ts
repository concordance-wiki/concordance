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
