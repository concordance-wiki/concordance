import { afterEach, describe, expect, it, vi } from "vitest";

describe("the category-list hydration entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("looks for the islands of the category list in the document as soon as it loads", async () => {
    const selectors: string[] = [];
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return [];
      },
    });
    await import("../../src/islands/category-list.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="category-list"]']);
  });
});
