// @vitest-environment happy-dom
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { ageNoticeCorporate } from "../../src/gallery/fixtures.js";
import { AGE_ISLAND } from "../../src/islands/age.js";
import { AgeNotice } from "../../src/theme/default/age-notice.js";

describe("the age entry", () => {
  it("wires every notice of the document with the clock and the storage of the browser", async () => {
    const rest = { ...ageNoticeCorporate };
    delete rest.days;
    document.body.innerHTML = renderToString(h(AgeNotice, rest));
    const element = document.querySelector<HTMLElement>(`[data-island="${AGE_ISLAND}"]`);
    if (element === null) throw new Error("no island");
    await import("../../src/islands/age.client.js");
    // The fixture was published long ago: the notice shows, its days counted from today.
    expect(element.querySelector<HTMLElement>(".age-notice")?.hidden).toBe(false);
  });
});
