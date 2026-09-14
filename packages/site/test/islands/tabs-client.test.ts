// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { corporateMeetingPage } from "../../src/gallery/fixtures.js";
import { TABS_SCRIPTED } from "../../src/islands/tabs.js";
import { renderSlot } from "../../src/render.js";
import { defaultTheme } from "../../src/theme/resolve.js";

describe("the tabs entry", () => {
  it("wires every row of tabs of the document with its window: the panel the address names shown, the others hidden", async () => {
    window.location.hash = "#representation-notes";
    document.body.innerHTML = renderSlot("EntityPage", corporateMeetingPage, defaultTheme);
    await import("../../src/islands/tabs.client.js");
    expect(document.querySelector(".tabs")?.classList.contains(TABS_SCRIPTED)).toBe(true);
    expect(
      [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')].map((panel) => panel.hidden),
    ).toEqual([true, false, true]);
    document.querySelector<HTMLElement>('[aria-controls="representation-deck"]')?.click();
    expect(window.location.hash).toBe("#representation-deck");
  });
});
