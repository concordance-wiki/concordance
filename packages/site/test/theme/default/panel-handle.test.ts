import { describe, expect, it } from "vitest";

import { componentsStylesheet } from "../../../src/css/stylesheet.js";
import {
  corporateApiPage,
  corporateEntityPage,
  corporateHeader,
  corporateKeywordPage,
  corporateMeetingPage,
  documentPageCorporate,
  header,
} from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { entityClasses } from "../../../src/theme/default/entity-page.js";
import { defaultPanelsLabels, PANELS_ISLAND } from "../../../src/theme/default/panel-handle.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import {
  PANEL_HANDLE,
  PIN_BUTTON,
  TREE_HANDLE,
  withoutHiddenControls,
} from "../../helpers/handles.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("The handles folding the side panels of the entity page", () => {
  it("serves a hidden handle at the head of the tree and of the right panel, each naming its panel, unfolded, titled as the fold control", () => {
    const html = renderSlot("EntityPage", corporateEntityPage, defaultTheme);
    expect(html).toContain(
      `<nav class="space" aria-label="Tree of the space">${TREE_HANDLE}<a class=`,
    );
    expect(html).toContain(`<div class="entity-side">${PANEL_HANDLE}<section class=`);
    expect(html).toContain(`</h1>${PIN_BUTTON}<p class="entity-badge">`);
    expect(count(html, "panel-handle-track")).toBe(2);
    expect(html).toContain('<div class="entity entity-with-space">');
    expectBalanced(html);
  });

  it("serves the panels folded on request, the handles drawn as decorations and the layout carrying one class per folded panel", () => {
    const html = renderSlot(
      "EntityPage",
      { ...corporateEntityPage, folded: ["tree", "panel"] },
      defaultTheme,
    );
    expect(html).toContain(
      '<div class="entity entity-with-space entity-tree-folded entity-panel-folded">',
    );
    expect(html).toContain(
      '<div class="panel-handle-track"><span class="panel-handle panel-handle-folded" data-panel="tree" aria-hidden="true"></span></div>',
    );
    expect(html).toContain(
      '<div class="panel-handle-track"><span class="panel-handle panel-handle-folded" data-panel="panel" aria-hidden="true"></span></div>',
    );
    expect(withoutHiddenControls(html)).not.toContain("<button");
    const tree = renderSlot(
      "EntityPage",
      { ...corporateEntityPage, folded: ["tree"] },
      defaultTheme,
    );
    expect(tree).toContain('<div class="entity entity-with-space entity-tree-folded">');
    expect(tree).toContain(PANEL_HANDLE);
    expect(entityClasses(false, ["panel"], "keyword")).toBe("entity entity-panel-folded keyword");
  });

  it("gives every page with a space its tree handle and every page with a panel its panel handle: the keyword, API, meeting and document pages as the entity page", () => {
    const keyword = renderSlot("KeywordPage", corporateKeywordPage, defaultTheme);
    expect(keyword).toContain(TREE_HANDLE);
    expect(keyword).toContain(PANEL_HANDLE);
    for (const props of [corporateApiPage, corporateMeetingPage, documentPageCorporate]) {
      const html = renderSlot("EntityPage", props, defaultTheme);
      expect(html, props.entity.type).toContain(TREE_HANDLE);
      expect(html, props.entity.type).toContain(PANEL_HANDLE);
    }
  });

  it("carries the labels of the handles in an empty island after the bar, the English of the default theme when the header receives none", () => {
    const html = renderSlot("Header", header, defaultTheme);
    expect(html).toContain(
      `</concordance-island><concordance-island data-island="${PANELS_ISLAND}" data-props="{&quot;labels&quot;:{&quot;fold&quot;:&quot;Fold or unfold&quot;,&quot;tree&quot;:&quot;Tree of the space&quot;,&quot;panel&quot;:&quot;Right panel&quot;}}"></concordance-island></header>`,
    );
    expect(defaultPanelsLabels).toEqual({
      fold: "Fold or unfold",
      tree: "Tree of the space",
      panel: "Right panel",
    });
    const localised = renderSlot(
      "Header",
      {
        ...corporateHeader,
        panels: {
          labels: { fold: "Replier ou déplier", tree: "Arborescence", panel: "Volet de droite" },
        },
      },
      defaultTheme,
    );
    expect(localised).toContain(
      'data-props="{&quot;labels&quot;:{&quot;fold&quot;:&quot;Replier ou déplier&quot;,&quot;tree&quot;:&quot;Arborescence&quot;,&quot;panel&quot;:&quot;Volet de droite&quot;}}"></concordance-island>',
    );
  });

  it("keeps both panels in view while the text scrolls, each no taller than the viewport and scrolling on its own, from the desktop width only", () => {
    const css = componentsStylesheet();
    expect(css).toContain(
      "  .space,\n  .entity-side {\n    position: sticky;\n    inset-block-start: 0;\n    align-self: start;\n    min-block-size: 100dvh;\n    max-block-size: 100dvh;\n    overflow-y: auto;\n    overscroll-behavior: contain;\n  }",
    );
    expect(css.indexOf("  .space,\n  .entity-side {\n    position: sticky;")).toBeGreaterThan(
      css.indexOf("@media (min-width: 68.75rem) {\n  .space,\n  .entity-side {"),
    );
  });

  it("draws the handle as a 26 px tab clipped to its outer 13 px, fixed to the middle of the viewport at the edge of its column, from the desktop width only, and folds each panel to 44 px on the root attribute or the served class", () => {
    const css = componentsStylesheet();
    expect(css).toContain(".panel-handle-track {\n  display: none;\n}");
    expect(css).toContain(
      "  .panel-handle-track {\n    display: block;\n    block-size: 0;\n    pointer-events: none;\n  }",
    );
    expect(css).toContain(
      "  .panel-handle {\n    position: fixed;\n    z-index: 1;\n    inset-block-start: calc(50vh - 1.25rem);\n    inset-inline-start: calc(var(--tree-column) - 0.8125rem);\n    inset-inline-end: auto;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    inline-size: 1.625rem;\n    block-size: 2.5rem;\n    padding: 0 0 0 0.8125rem;\n    border: 1px solid var(--color-border);\n    border-radius: var(--radius);\n    background: var(--color-soft);\n    color: var(--color-label);",
    );
    expect(css).toContain(
      "  .entity-side > .panel-handle-track > .panel-handle {\n    inset-inline-start: auto;\n    inset-inline-end: calc(var(--panel-column) - 0.8125rem);",
    );
    expect(css).toContain("    clip-path: inset(-0.375rem -0.375rem -0.375rem 0.8125rem);");
    expect(css).toContain("  .panel-handle[hidden] {\n    display: none;\n  }");
    expect(css).toContain('  .panel-handle::before {\n    content: "‹" / "";\n  }');
    expect(css).toContain(
      '  .panel-handle[aria-expanded="false"]::before,\n  .panel-handle-folded::before {\n    content: "›" / "";\n  }',
    );
    expect(css).toContain(
      '  :root[data-panels~="tree"] .entity,\n  :root[data-panels~="tree"] .category,\n  .entity-tree-folded {\n    --tree-column: 2.75rem;\n  }',
    );
    expect(css).toContain(
      '  :root[data-panels~="panel"] .entity,\n  :root[data-panels~="panel"] .entity:has(> .entity-side > .neighbourhood-fold[open]),\n  .entity-panel-folded,\n  .entity-panel-folded:has(> .entity-side > .neighbourhood-fold[open]) {\n    --panel-column: 2.75rem;\n  }',
    );
    expect(css).toContain(
      "    writing-mode: vertical-rl;\n    transform: rotate(180deg);\n    visibility: visible;\n  }",
    );
    expect(css).toContain(
      '  :root[data-panels~="tree"] .entity-with-space > .entity-main > *,\n  :root[data-panels~="panel"] .entity > .entity-main > *,\n  .entity-tree-folded > .entity-main > *,\n  .entity-panel-folded > .entity-main > * {\n    max-inline-size: 75rem;\n  }',
    );
    expect(css).toContain("    max-inline-size: 50rem;\n  }\n}");
    const start = css.indexOf("/* Side panels folded behind a handle");
    expect(start).toBeGreaterThan(css.indexOf(".category {\n  display: grid;"));
    expect(start).toBeGreaterThan(css.indexOf(".neighbourhood-fold {"));
  });
});
