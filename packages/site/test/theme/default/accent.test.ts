import { memoryFileSystem } from "@concordance-wiki/core";
import { beforeAll, describe, expect, it } from "vitest";

import { baseStylesheet, componentsStylesheet } from "../../../src/css/stylesheet.js";
import { buildGallery } from "../../../src/gallery/build.js";
import { TABS_MARKED } from "../../../src/theme/default/meeting-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count } from "../../helpers/html.js";

interface Rule {
  selector: string;
  body: string;
}

/** Every innermost rule of a stylesheet; at-rules only wrap them, so their prelude is never a selector. */
function rulesOf(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim().replace(/^.*\n\n/s, ""),
    body: match[2] ?? "",
  }));
}

function accentRules(css: string): Rule[] {
  return rulesOf(css).filter((rule) => rule.body.includes("--color-accent"));
}

function ruleFor(rules: Rule[], selector: string): Rule {
  const rule = rules.find((candidate) => candidate.selector === selector);
  expect(rule, selector).toBeDefined();
  // Asserted just above.
  return rule as Rule;
}

const FOCUS_RING = [
  "a:focus-visible",
  "button:focus-visible",
  "input:focus-visible",
  "select:focus-visible",
  "textarea:focus-visible",
  "summary:focus-visible",
  "[tabindex]:focus-visible",
].join(",\n");

const CONTRACT_BUTTONS = [
  ".contract-data button",
  ".contract-operation > button",
  ".contract-schema-list button",
].join(",\n");

/** The tab whose panel is in view, by position, the first one until a tab or an anchor inside a panel is followed; laid out as the stylesheet formats it inside its `@supports` block. */
const CURRENT_TAB = [
  "  .meeting-representations:not(:has(.meeting-panel:target, .meeting-panel :target))\n    .meeting-tab:nth-child(1)",
  ...Array.from({ length: TABS_MARKED }, (_, index) => index + 1).map(
    (position) =>
      `.meeting-representations:has(\n      .meeting-panel:nth-child(${String(position)}):target,\n      .meeting-panel:nth-child(${String(position)}) :target\n    )\n    .meeting-tab:nth-child(${String(position)})`,
  ),
].join(",\n  ");

/** The tab of the document page whose view is shown: the first one until a view is targeted. */
const DOCUMENT_TAB_CURRENT = [
  ".document-page:not(:has(.document-panel:target, .document-panel :target)) .document-tab-view",
  ".document-page:has(#document-view:target) .document-tab-view",
  ".document-page:has(#document-text:target, #document-text :target) .document-tab-text",
  ".document-page:has(#document-notes:target, #document-notes :target) .document-tab-notes",
].join(",\n");

describe("The accent colour never carries information on its own", () => {
  const base = accentRules(baseStylesheet());
  const components = accentRules(componentsStylesheet());
  let pages: Map<string, string>;

  beforeAll(async () => {
    const fileSystem = memoryFileSystem();
    await buildGallery({ output: "/out", theme: defaultTheme, fileSystem });
    pages = new Map(
      fileSystem
        .listFiles("/out")
        .filter((file) => file.endsWith(".html"))
        .map((file) => [file, fileSystem.readText(`/out/${file}`)]),
    );
  });

  it("uses the accent in a known, documented set of places and nowhere else: links and the current position, never a status or a decoration", () => {
    expect(base.map((rule) => rule.selector)).toEqual(["a", FOCUS_RING]);
    expect(components.map((rule) => rule.selector)).toEqual([
      ".space-current > span",
      ".markdown .written",
      ".markdown .recognised,\n.markdown .recognised-keyword",
      ".legend-written::before,\n.legend-recognised::before,\n.legend-keyword::before",
      ".related-clear",
      ".related-mark",
      ".neighbourhood-icon-centre",
      CONTRACT_BUTTONS,
      ".neighbourhood-graph .map-centre .map-shape",
      ".keyword-notice",
      ".passage-at",
      ".neighbour::before",
      CURRENT_TAB,
      ".cue-time",
      ".spaces-row.stale .spaces-date",
      DOCUMENT_TAB_CURRENT,
      ".document-page .document-rail a.current",
    ]);
  });

  it("underlines links, the clearing of the type filter and the buttons of the contract viewer, so that colour is not their only mark", () => {
    expect(ruleFor(base, "a").body).toContain("text-decoration: underline;");
    expect(ruleFor(components, ".related-clear").body).toContain("text-decoration: underline;");
    expect(ruleFor(components, CONTRACT_BUTTONS).body).toContain("text-decoration: underline;");
  });

  it("marks the current page of the tree by a rule and the bold weight, and a cited page by a word, never by the colour alone", () => {
    const current = ruleFor(components, ".space-current > span").body;
    expect(current).toContain("border-inline-start: 3px solid var(--color-accent);");
    expect(current).toContain("font-weight: 600;");
    const page = pages.get("entity-page-corporate.html") ?? "";
    expect(page).toContain(
      '<li class="space-page space-current"><span aria-current="page">Publication threshold</span></li>',
    );
    expect(page).toContain('<span class="related-mark">Cited · </span>');
  });

  it("draws the focus ring as an offset outline, visible whatever the accent", () => {
    const body = ruleFor(base, FOCUS_RING).body;
    expect(body).toContain("outline: 3px solid var(--color-accent);");
    expect(body).toContain("outline-offset: 2px;");
  });

  it("marks a written link by its underline, a recognised word by a dotted accent one and a word without a note by grey dashes, the legend saying so in words", () => {
    const written = ruleFor(components, ".markdown .written").body;
    expect(written).not.toContain("text-decoration: none");
    const rules = rulesOf(componentsStylesheet());
    const recognised = rules.find(
      (rule) => rule.selector === ".markdown .recognised,\n.markdown .recognised-keyword",
    )?.body;
    expect(recognised).toContain("text-decoration-style: dotted;");
    expect(recognised).toContain("text-decoration-color: var(--color-accent);");
    const keyword = rules.find((rule) => rule.selector === ".markdown .recognised-keyword")?.body;
    expect(keyword).toContain("text-decoration-style: dashed;");
    expect(keyword).toContain("text-decoration-color: var(--color-label);");
    expect(keyword).not.toContain("accent");
    const page = pages.get("entity-page.html") ?? "";
    for (const match of page.matchAll(/<(\w+)[^>]*class="written"/g)) {
      expect(match[1]).toBe("a");
    }
    expect(count(page, 'class="written"')).toBeGreaterThan(0);
    expect(page).toContain('<span class="legend-written">written link</span>');
    expect(page).toContain('<span class="legend-recognised">recognised word, existing note</span>');
    expect(page).toContain('<span class="legend-keyword">recognised word, no note</span>');
  });

  it("gives the accent-bordered notice of a keyword page a text of its own, and underlines the position of a passage", () => {
    const keyword = pages.get("keyword-page.html") ?? "";
    expect(keyword).toMatch(
      /<aside class="keyword-notice" role="note"><p class="keyword-notice-lead">Nobody has written a definition, but \d+ passages use this word\.<\/p><a class="create-note" [^>]*>Propose a definition<\/a><\/aside>/,
    );
    expect(ruleFor(components, ".passage-at").body).toContain("text-decoration: underline;");
    expect(keyword).toContain('<a class="passage-at" href="../build-pipeline/#L12">line 12</a>');
  });

  it("draws the current position in the accent on the map and in the mark of the fold line, and the mark of every neighbour row, the words of the line and of the list saying what they are", () => {
    expect(ruleFor(components, ".neighbourhood-graph .map-centre .map-shape").body).toContain(
      "fill: var(--color-accent);",
    );
    expect(ruleFor(components, ".neighbourhood-icon-centre").body).toBe(
      "\n  fill: var(--color-accent);\n",
    );
    expect(ruleFor(components, ".neighbour::before").body).toContain('content: "●" / "";');
    const page = pages.get("entity-page-map.html") ?? "";
    expect(page).toContain(
      '<svg class="neighbourhood-icon" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
    );
    expect(page).toContain('<span class="neighbourhood-lead">See the neighbourhood map</span>');
    expect(page).toMatch(
      /<g class="map-centre"><circle class="map-shape" cx="\d+" cy="\d+" r="10"><\/circle><text class="map-label" [^>]+>Publication threshold<\/text>/,
    );
    expect(page).toContain('<span class="neighbour-type">Keyword</span>');
  });

  it("doubles the accent of a dormant space on the spaces page by its age in days, the one place where the colour carries an alert", () => {
    expect(ruleFor(components, ".spaces-row.stale .spaces-date").body).toBe(
      "\n  color: var(--color-accent);\n",
    );
    const spaces = pages.get("spaces-corporate.html") ?? "";
    expect(spaces).toContain(
      '<tr class="spaces-row stale"><th scope="row" class="spaces-name"><span class="space-initials" aria-hidden="true">FR</span><a href="../framing/">framing</a></th><td class="spaces-content">Document</td><td class="spaces-count">4</td><td class="spaces-date"><time datetime="2026-03-03">194 days ago</time></td></tr>',
    );
  });

  it("marks the current tab of a meeting page by a rule and the bold weight, and underlines the timecode of a cue", () => {
    const current = ruleFor(components, CURRENT_TAB).body;
    expect(current).toContain("border-block-end-color: var(--color-accent);");
    expect(current).toContain("font-weight: 600;");
    expect(ruleFor(components, ".cue-time").body).toContain("text-decoration: underline;");
    const meeting = pages.get("meeting-page-corporate.html") ?? "";
    expect(meeting).toContain('<a class="cue-time" href="#L1-2">11:48</a>');
  });

  it("names the colour scheme in the mode switch instead of showing a coloured state alone", () => {
    for (const [file, page] of pages) {
      expect(page, file).toContain(
        '<span class="mode-switch-label">Colour scheme</span> <span class="mode-switch-value">automatic</span>',
      );
    }
  });
});
