import { h, type JSX } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { ISLAND_ELEMENT, island, islandsUsed } from "../../src/islands/island.js";

function Greeting({ name }: { name: string }): JSX.Element {
  return h("p", null, `hello ${name}`);
}

describe("island", () => {
  it("wraps the static markup in the island element carrying the name and the serialised props", () => {
    const Greet = island("greeting", Greeting);
    expect(renderToString(h(Greet, { name: "world" }))).toBe(
      '<concordance-island data-island="greeting" data-props="{&quot;name&quot;:&quot;world&quot;}"><p>hello world</p></concordance-island>',
    );
    expect(Greet.displayName).toBe("Island(greeting)");
    expect(ISLAND_ELEMENT).toBe("concordance-island");
  });

  it("escapes the props so that markup in the data stays data", () => {
    const Greet = island("greeting", Greeting);
    const html = renderToString(h(Greet, { name: '</concordance-island><script>"' }));
    expect(html).toContain(
      'data-props="{&quot;name&quot;:&quot;&lt;/concordance-island>&lt;script>\\&quot;&quot;}"',
    );
    expect(html.split("<concordance-island")).toHaveLength(2);
  });
});

describe("islandsUsed", () => {
  it("lists the islands of a document once each, sorted by name", () => {
    const html = [
      '<concordance-island data-island="zeta" data-props="{}"></concordance-island>',
      '<concordance-island data-island="alpha" data-props="{}"></concordance-island>',
      '<concordance-island data-island="zeta" data-props="{}"></concordance-island>',
      "<p>&lt;concordance-island data-island=&quot;fake&quot;</p>",
    ].join("");
    expect(islandsUsed(html)).toEqual(["alpha", "zeta"]);
  });

  it("finds nothing in a page without an island", () => {
    expect(islandsUsed("<p>plain</p>")).toEqual([]);
  });
});
