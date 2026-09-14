import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import {
  foldedValue,
  isPanel,
  PANEL_KEYS,
  PANELS,
  PANELS_SCRIPT,
  PANELS_STORAGE_KEY,
  parseFolded,
} from "../src/panels.js";

describe("The side panels a reader folds, remembered under one key", () => {
  it("names the two panels, the tree first, and gives each its bracket key", () => {
    expect(PANELS).toEqual(["tree", "panel"]);
    expect(PANEL_KEYS).toEqual({ tree: "[", panel: "]" });
    expect(isPanel("tree")).toBe(true);
    expect(isPanel("panel")).toBe(true);
    expect(isPanel("drawer")).toBe(false);
    expect(isPanel(null)).toBe(false);
  });

  it("reads the folded panels from the stored value, in the order of the panels, each once, anything unknown left out", () => {
    expect(parseFolded(null)).toEqual([]);
    expect(parseFolded("")).toEqual([]);
    expect(parseFolded("tree")).toEqual(["tree"]);
    expect(parseFolded("panel tree")).toEqual(["tree", "panel"]);
    expect(parseFolded("panel panel")).toEqual(["panel"]);
    expect(parseFolded("drawer  tree")).toEqual(["tree"]);
  });

  it("writes the folded panels as one value in the order of the panels, and none as no value", () => {
    expect(foldedValue([])).toBeUndefined();
    expect(foldedValue(["panel"])).toBe("panel");
    expect(foldedValue(["panel", "tree"])).toBe("tree panel");
  });

  it("keeps the inline script under 200 bytes, copying only the stored value to data-panels before the first paint", () => {
    expect(PANELS_STORAGE_KEY).toBe("concordance-panels");
    expect(Buffer.byteLength(PANELS_SCRIPT)).toBeLessThan(200);
    expect(PANELS_SCRIPT).toContain(`localStorage.getItem("${PANELS_STORAGE_KEY}")`);
    expect(PANELS_SCRIPT).toContain("document.documentElement.dataset.panels=p");
    expect(PANELS_SCRIPT).not.toContain("<");
    const run = (stored: string | null, dataset: { panels?: string }): void => {
      runInNewContext(PANELS_SCRIPT, {
        localStorage: { getItem: () => stored },
        document: { documentElement: { dataset } },
      });
    };
    const folded: { panels?: string } = {};
    run("tree panel", folded);
    expect(folded.panels).toBe("tree panel");
    const open: { panels?: string } = {};
    run(null, open);
    expect(open).toEqual({});
    run("", open);
    expect(open).toEqual({});
    const untouched: { panels?: string } = {};
    expect(() => {
      runInNewContext(PANELS_SCRIPT, {
        localStorage: {
          getItem: () => {
            throw new Error("storage disabled");
          },
        },
        document: { documentElement: { dataset: untouched } },
      });
    }).not.toThrow();
    expect(untouched).toEqual({});
  });
});
