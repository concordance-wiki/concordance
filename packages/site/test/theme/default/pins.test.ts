import { describe, expect, it } from "vitest";

import { componentsStylesheet } from "../../../src/css/stylesheet.js";
import {
  corporateEntityPage,
  corporateHeader,
  corporatePinnedHeader,
  corporatePins,
  header,
} from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { defaultPinsLabels, PIN_GLYPH, PINS_ISLAND } from "../../../src/theme/default/pins.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { PIN_BUTTON } from "../../helpers/handles.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Pinned pages: the island after the bar and the button of the page header", () => {
  it("serves the island empty after the bar with its labels and, on an entity page, the page its button pins, so that without JavaScript the bar has no row", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      `</nav><concordance-island data-island="${PINS_ISLAND}" data-props="{&quot;base&quot;:&quot;&quot;,&quot;labels&quot;:{&quot;pin&quot;:&quot;Pin&quot;,&quot;pinned&quot;:&quot;Pinned&quot;,&quot;label&quot;:&quot;Pinned&quot;,&quot;pages&quot;:&quot;Pinned pages&quot;,&quot;countOne&quot;:&quot;{count} pinned&quot;,&quot;countMany&quot;:&quot;{count} pinned&quot;,&quot;unpin&quot;:&quot;Unpin {title}&quot;,&quot;all&quot;:&quot;All pinned&quot;,&quot;filter&quot;:&quot;Filter&quot;,&quot;removeAll&quot;:&quot;Remove all&quot;,&quot;confirmRemoveAll&quot;:&quot;Remove every pinned page?&quot;}}"></concordance-island><concordance-island data-island="panels"`,
    );
    expect(defaultPinsLabels.confirmRemoveAll).toBe("Remove every pinned page?");
    const entity = renderSlot(
      "Header",
      {
        ...corporateHeader,
        pins: {
          base: "../../",
          current: { id: "glossary/keyword-page", title: "Keyword page" },
          labels: { ...defaultPinsLabels, pin: "Épingler" },
        },
      },
      defaultTheme,
    );
    expect(entity).toContain(
      "&quot;current&quot;:{&quot;id&quot;:&quot;glossary/keyword-page&quot;,&quot;title&quot;:&quot;Keyword page&quot;}",
    );
    expect(entity).toContain("&quot;pin&quot;:&quot;Épingler&quot;");
    expect(entity).toContain('data-island="pins" data-props="{&quot;base&quot;:&quot;../../&quot;');
    expect(entity).not.toContain('<nav class="pins"');
  });

  it("serves the row in the island when pins are given, as the gallery previews it, the current page marked", () => {
    const html = renderSlot("Header", corporatePinnedHeader, defaultTheme);
    expect(html).toContain(
      '<div class="pins-preview"><nav class="pins" aria-label="Pinned pages">',
    );
    expect(count(html, '<li class="pin"') + count(html, '<li class="pin pin-current"')).toBe(
      corporatePins.length,
    );
    expect(count(html, '<li class="pins-row')).toBe(corporatePins.length);
    expect(html).toContain(
      '<li class="pin pin-current"><a href="../../specs/rules/publication-threshold/index.html" aria-current="page">Publication threshold</a>',
    );
    expect(html).toContain(
      `<span class="pins-count">${String(corporatePins.length)} pinned</span></nav></div></concordance-island>`,
    );
    expectBalanced(html);
  });

  it("serves the button of the page header hidden and unpressed after the title, drawing the pin, and drawn pressed as a decoration to preview a pinned page", () => {
    const html = renderSlot("EntityPage", corporateEntityPage, defaultTheme);
    expect(html).toContain(`</h1>${PIN_BUTTON}<p class="entity-badge">`);
    expect(PIN_BUTTON).toContain(PIN_GLYPH);
    const pinned = renderSlot("EntityPage", { ...corporateEntityPage, pinned: true }, defaultTheme);
    expect(pinned).toContain(
      `</h1><span class="pin-button pin-button-pinned" aria-hidden="true"><span class="pin-button-glyph">${PIN_GLYPH}</span><span class="pin-button-label">Pinned</span></span><p class="entity-badge">`,
    );
    expect(pinned).not.toContain('pin-button" aria-pressed');
  });

  it("draws the row under the bar, the chips of 40 px, the current one filled in the ink, the menu unfolded under its summary, and the button after the title", () => {
    const css = componentsStylesheet();
    expect(css).toContain('concordance-island[data-island="pins"]:empty {\n  display: none;\n}');
    expect(css).toContain(
      ".pins {\n  display: flex;\n  flex-wrap: nowrap;\n  gap: 0.4375rem;\n  align-items: center;\n  min-block-size: 2.75rem;\n  padding: 0.125rem var(--space-4);\n  border-block-start: 1px solid var(--color-border);\n  background: var(--color-surface);\n}",
    );
    expect(css).toContain(
      ".pin {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  min-block-size: 2.5rem;",
    );
    expect(css).toContain(".pin[hidden],\n.pins-row[hidden] {\n  display: none;\n}");
    expect(css).toContain(".pin-button[hidden] {\n  display: none;\n}");
    expect(css).toContain(
      ".pin-current {\n  border-color: var(--color-ink);\n  background: var(--color-ink);\n  color: var(--color-surface);\n  font-weight: 600;\n}",
    );
    expect(css).toContain(
      ".pins-menu {\n  position: absolute;\n  inset-inline-end: 0;\n  inset-block-start: calc(100% + 0.375rem);\n  z-index: 3;",
    );
    expect(css).toContain(
      ".entity-header {\n  display: flex;\n  flex-wrap: wrap;\n  column-gap: 0.875rem;\n  align-items: center;\n}",
    );
    expect(css).toContain(
      '.pin-button[aria-pressed="true"],\n.pin-button-pinned {\n  border-color: var(--color-ink);\n  background: var(--color-ink);\n  color: var(--color-surface);\n}',
    );
    expect(css).not.toContain("trail");
  });
});
