import { memoryFileSystem } from "@concordance-wiki/core";
import { beforeAll, describe, expect, it } from "vitest";

import { baseStylesheet, componentsStylesheet } from "../../../src/css/stylesheet.js";
import { buildGallery } from "../../../src/gallery/build.js";
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

  it("uses the accent in a known, documented set of places and nowhere else", () => {
    expect(base.map((rule) => rule.selector)).toEqual(["a", FOCUS_RING]);
    expect(components.map((rule) => rule.selector)).toEqual([
      ".markdown .written",
      ".legend-written::before,\n.legend-recognised::before",
      ".banner",
      ".mentions-group h3",
      ".mentions-more button",
      CONTRACT_BUTTONS,
    ]);
  });

  it("underlines links, the disclosure of the remaining mentions and the buttons of the contract viewer, so that colour is not their only mark", () => {
    expect(ruleFor(base, "a").body).toContain("text-decoration: underline;");
    expect(ruleFor(components, ".mentions-more button").body).toContain(
      "text-decoration: underline;",
    );
    expect(ruleFor(components, CONTRACT_BUTTONS).body).toContain("text-decoration: underline;");
  });

  it("draws the focus ring as an offset outline, visible whatever the accent", () => {
    const body = ruleFor(base, FOCUS_RING).body;
    expect(body).toContain("outline: 3px solid var(--color-accent);");
    expect(body).toContain("outline-offset: 2px;");
  });

  it("marks a written link by its underline and a recognised word by a dotted one, the legend saying so in words", () => {
    const written = ruleFor(components, ".markdown .written").body;
    expect(written).not.toContain("text-decoration: none");
    expect(
      rulesOf(componentsStylesheet()).find((rule) => rule.selector === ".markdown .recognised")
        ?.body,
    ).toContain("text-decoration: underline dotted;");
    const page = pages.get("entity-page.html") ?? "";
    for (const match of page.matchAll(/<(\w+)[^>]*class="written"/g)) {
      expect(match[1]).toBe("a");
    }
    expect(count(page, 'class="written"')).toBeGreaterThan(0);
    expect(page).toContain('<span class="legend-written">link written in the note</span>');
    expect(page).toContain('<span class="legend-recognised">word recognised at indexing</span>');
  });

  it("gives the accent-bordered banner and the accent headings of the mentions a text of their own", () => {
    const keyword = pages.get("keyword-page.html") ?? "";
    expect(keyword).toMatch(
      /<p class="banner" role="note">Expression without a note\. \d+ passages recorded\. <a class="create-note" [^>]*>Create a note<\/a><\/p>/,
    );
    const mentions = pages.get("mentions-panel.html") ?? "";
    expect(mentions).toContain(
      '<h3 id="mentions-written">Written in notes <span class="count">2</span></h3>',
    );
    expect(mentions).toContain(
      '<h3 id="mentions-recognised">Recognised in files <span class="count">1</span></h3>',
    );
  });

  it("names the colour scheme in the mode switch instead of showing a coloured state alone", () => {
    for (const [file, page] of pages) {
      expect(page, file).toContain(
        '<span class="mode-switch-label">Colour scheme</span> <span class="mode-switch-value">automatic</span>',
      );
    }
  });
});
