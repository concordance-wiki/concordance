import { h, type JSX } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

import { mountIslands } from "../../src/islands/mount.js";

interface FakeElement {
  attributes: Record<string, string>;
  getAttribute(name: string): string | null;
}

function element(attributes: Record<string, string>): FakeElement {
  return { attributes, getAttribute: (name) => attributes[name] ?? null };
}

function Greeting({ name }: { name: string }): JSX.Element {
  return h("p", null, `hello ${name}`);
}

describe("mountIslands", () => {
  it("mounts the component with the props read from every island of that name", () => {
    const found = [
      element({ "data-props": '{"name":"a"}' }),
      element({ "data-props": '{"name":"b"}' }),
    ];
    const selectors: string[] = [];
    const mount = vi.fn();
    const mounted = mountIslands(
      "greeting",
      Greeting,
      {
        querySelectorAll: (selector) => {
          selectors.push(selector);
          return found;
        },
      },
      mount,
    );
    expect(mounted).toBe(2);
    expect(selectors).toEqual(['concordance-island[data-island="greeting"]']);
    expect(mount).toHaveBeenCalledTimes(2);
    const [first, second] = mount.mock.calls;
    expect(renderToString(first?.[0] as JSX.Element)).toBe("<p>hello a</p>");
    expect(first?.[1]).toBe(found[0]);
    expect(renderToString(second?.[0] as JSX.Element)).toBe("<p>hello b</p>");
  });

  it("mounts with empty props when the attribute is missing and nothing when no island is there", () => {
    const mount = vi.fn();
    expect(
      mountIslands("greeting", Greeting, { querySelectorAll: () => [element({})] }, mount),
    ).toBe(1);
    expect((mount.mock.calls[0]?.[0] as JSX.Element).props).toEqual({});
    expect(mountIslands("greeting", Greeting, { querySelectorAll: () => [] }, mount)).toBe(0);
  });
});
