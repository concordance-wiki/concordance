// @vitest-environment happy-dom
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { notFoundCorporate } from "../../src/gallery/fixtures.js";
import { NOT_FOUND_ISLAND } from "../../src/islands/not-found.js";
import { NotFound } from "../../src/theme/default/not-found.js";

describe("the not-found entry", () => {
  it("wires the island with the document and injects the shard script through a classic script tag", async () => {
    document.body.innerHTML = renderToString(h(NotFound, notFoundCorporate));
    const element = document.querySelector(`[data-island="${NOT_FOUND_ISLAND}"]`);
    if (element === null) throw new Error("no island");
    await import("../../src/islands/not-found.client.js");
    const script = document.head.querySelector<HTMLScriptElement>("script[src]");
    expect(script).not.toBeNull();
    // The shard never arrives in the test: both outcomes of the injection leave the page usable.
    script?.dispatchEvent(new Event("error"));
    script?.dispatchEvent(new Event("load"));
    expect(element.querySelector(".button-primary")).not.toBeNull();
  });
});
