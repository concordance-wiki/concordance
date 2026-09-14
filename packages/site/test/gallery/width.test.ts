import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GALLERY_WIDTHS } from "../../src/gallery/page.js";
import {
  FRAME_SELECTOR,
  widthOf,
  wireWidthSwitch,
  type WidthButton,
  type WidthElement,
  type WidthFrame,
  type WidthGroup,
  type WidthHost,
} from "../../src/gallery/width.js";
import { WidthSwitch } from "../../src/gallery/width-switch.js";

interface FakeButton extends WidthButton {
  attributes: Record<string, string>;
  click: () => void;
}

function button(width: string): FakeButton {
  const attributes: Record<string, string> = { "data-width": width, "aria-pressed": "false" };
  const listeners: (() => void)[] = [];
  return {
    attributes,
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
    addEventListener: (_type, listener) => {
      listeners.push(listener);
    },
    click: () => {
      for (const listener of listeners) listener();
    },
  };
}

function frame(): WidthFrame & { attributes: Record<string, string> } {
  const attributes: Record<string, string> = { width: "1440" };
  return {
    attributes,
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
  };
}

function host(frames: WidthFrame[]): WidthHost & { selectors: string[] } {
  const selectors: string[] = [];
  return {
    selectors,
    querySelectorAll: (selector) => {
      selectors.push(selector);
      return frames;
    },
  };
}

function element(buttons: FakeButton[]): WidthElement & { group: WidthGroup } {
  const group: WidthGroup = { hidden: true, querySelectorAll: () => buttons };
  return { group, querySelector: (selector) => (selector === ".gallery-widths" ? group : null) };
}

describe("The width switch of the gallery index sets every frame to the width of one board", () => {
  it("renders three buttons served hidden inside a classic island, one per width", () => {
    expect(renderToString(h(WidthSwitch, {}))).toBe(
      '<concordance-island data-island="gallery-width" data-props="{&quot;label&quot;:&quot;Width of the frames&quot;,&quot;widths&quot;:[390,834,1440]}"><div class="gallery-widths" role="group" aria-label="Width of the frames" hidden><button type="button" class="gallery-width" data-width="390" aria-pressed="false">390 px</button><button type="button" class="gallery-width" data-width="834" aria-pressed="false">834 px</button><button type="button" class="gallery-width" data-width="1440" aria-pressed="false">1440 px</button></div></concordance-island>',
    );
  });

  it("reads the width a button sets from its attribute, and none from a value outside the three", () => {
    expect(widthOf(button("390"))).toBe(390);
    expect(widthOf(button("834"))).toBe(834);
    expect(widthOf(button("1440"))).toBe(1440);
    expect(widthOf(button("1000"))).toBeUndefined();
    expect(widthOf(button(""))).toBeUndefined();
    expect(GALLERY_WIDTHS).toEqual([390, 834, 1440]);
  });

  it("reveals the group and, on a click, rewrites the width of every frame and presses that button alone", () => {
    const buttons = [button("390"), button("834"), button("1440")];
    const frames = [frame(), frame()];
    const document = host(frames);
    const island = element(buttons);
    expect(wireWidthSwitch(island, document)).toBe(true);
    expect(island.group.hidden).toBe(false);
    expect(frames.map((f) => f.attributes["width"])).toEqual(["1440", "1440"]);
    buttons[1]?.click();
    expect(document.selectors).toEqual([FRAME_SELECTOR]);
    expect(frames.map((f) => f.attributes["width"])).toEqual(["834", "834"]);
    expect(buttons.map((b) => b.attributes["aria-pressed"])).toEqual(["false", "true", "false"]);
    buttons[0]?.click();
    expect(frames.map((f) => f.attributes["width"])).toEqual(["390", "390"]);
    expect(buttons.map((b) => b.attributes["aria-pressed"])).toEqual(["true", "false", "false"]);
  });

  it("wires no button whose width is not one of the three, and leaves an island without a group alone", () => {
    const stray = button("500");
    const frames = [frame()];
    const island = element([stray, button("390")]);
    expect(wireWidthSwitch(island, host(frames))).toBe(true);
    stray.click();
    expect(frames[0]?.attributes["width"]).toBe("1440");
    const empty: WidthElement = { querySelector: () => null };
    expect(wireWidthSwitch(empty, host(frames))).toBe(false);
  });
});

describe("the gallery-width hydration entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wires every width switch of the document as soon as it loads", async () => {
    const selectors: string[] = [];
    const group: WidthGroup = { hidden: true, querySelectorAll: () => [] };
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return selector.startsWith("concordance-island") ? [{ querySelector: () => group }] : [];
      },
    });
    await import("../../src/gallery/width.client.js");
    expect(selectors).toEqual(['concordance-island[data-island="gallery-width"]']);
    expect(group.hidden).toBe(false);
  });
});
