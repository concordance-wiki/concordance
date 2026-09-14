// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "disableJavaScriptEvaluation": true, "handleDisabledFileLoadingAsSuccess": true } }
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import axe, { type AxeResults, type ImpactValue, type Result } from "axe-core";
import { h, type JSX } from "preact";
import { describe, expect, it } from "vitest";

import { siteDocuments } from "../../src/build/site.js";
import { galleryDocuments, type GalleryDocument } from "../../src/gallery/build.js";
import * as galleryFixtures from "../../src/gallery/fixtures.js";
import { renderPage } from "../../src/render.js";
import { defaultComponents } from "../../src/theme/default/index.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";
import { fragments, model, profile, tokenize } from "../build/fixture.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");

/** The audit stops the build on these impacts; minor and moderate ones are reported, not blocking. */
const BLOCKING: ReadonlySet<ImpactValue> = new Set(["serious", "critical"]);

/**
 * Rules that need a layout engine, which no DOM implementation provides: the palette is checked
 * by the contrast test instead, over the pairs the stylesheet declares.
 */
const NEEDS_LAYOUT = ["color-contrast", "color-contrast-enhanced", "link-in-text-block"];

const islands = [
  { name: "age", file: "age-00000000.js", bytes: 0 },
  { name: "contract-viewer", file: "contract-viewer-00000000.js", bytes: 0 },
  { name: "document-viewer", file: "document-viewer-00000000.js", bytes: 0 },
  { name: "gallery-width", file: "gallery-width-00000000.js", bytes: 0 },
  { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
  { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
  { name: "not-found", file: "not-found-00000000.js", bytes: 0 },
  { name: "search", file: "search-00000000.js", bytes: 0 },
  { name: "tabs", file: "tabs-00000000.js", bytes: 0 },
  { name: "toc", file: "toc-00000000.js", bytes: 0 },
  { name: "panels", file: "panels-00000000.js", bytes: 0 },
  { name: "pins", file: "pins-00000000.js", bytes: 0 },
];

/**
 * Loads a rendered page into the test document, root attributes included, so that axe sees the
 * page as served. The frames of the gallery index keep their title and lose their address: the
 * audit reads none of them (`iframes: false`), and a frame the DOM would start loading, then
 * abort when the next page replaces it, traces a failed request for every page of the gallery.
 */
function load(html: string): void {
  const source = new DOMParser().parseFromString(
    html.replaceAll(/(<iframe\b[^>]*?)\ssrc="[^"]*"/gu, "$1"),
    "text/html",
  ).documentElement;
  const target = document.documentElement;
  for (const { name } of [...target.attributes]) target.removeAttribute(name);
  for (const { name, value } of [...source.attributes]) target.setAttribute(name, value);
  target.innerHTML = source.innerHTML;
}

async function audit(html: string): Promise<AxeResults> {
  load(html);
  return axe.run(document, {
    resultTypes: ["violations"],
    // The frames of the gallery index show pages audited on their own; the test document loads none of them.
    iframes: false,
    rules: Object.fromEntries(NEEDS_LAYOUT.map((rule) => [rule, { enabled: false }])),
  });
}

function describeViolation(violation: Result): string {
  return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.nodes
    .map((node) => node.html)
    .join(" | ")}`;
}

function blocking(results: AxeResults): string[] {
  return results.violations
    .filter((violation) => violation.impact !== undefined && BLOCKING.has(violation.impact))
    .map(describeViolation);
}

describe("An automated audit (axe-core) runs in continuous integration and fails on any serious or critical violation", () => {
  const documents: GalleryDocument[] = galleryDocuments(defaultTheme, islands);

  it("audits every page of the gallery, the index included", () => {
    expect(documents.map((document) => document.path)).toContain("index.html");
    expect(documents.length).toBeGreaterThan(18);
  });

  for (const { path, html } of documents) {
    it(`finds no violation at all on ${path}`, async () => {
      const results = await audit(html);
      expect(blocking(results)).toEqual([]);
      expect(results.violations.map(describeViolation)).toEqual([]);
    });
  }

  const site = siteDocuments(
    {
      model: model(),
      fragments,
      profile,
      theme: defaultTheme,
      locale: "en",
      projectName: "Concordance notes",
      tokenize,
    },
    islands,
  ).documents.filter((document) => document.path.endsWith(".html"));

  for (const { path, content } of site) {
    it(`finds no violation at all on the site page ${path}, rendered from a model`, async () => {
      const results = await audit(content);
      expect(blocking(results)).toEqual([]);
      expect(results.violations.map(describeViolation)).toEqual([]);
    });
  }

  it("fails on a serious violation brought by an overriding component and names the rule", async () => {
    const Footer = (): JSX.Element =>
      h("footer", { class: "site-footer" }, [
        h("input", { type: "text", name: "q" }),
        h("p", { role: "presentation", "aria-hidden": "true", tabindex: "0" }, "trap"),
      ]);
    const theme: ResolvedTheme = {
      components: { ...defaultComponents, Footer },
      overrides: [{ slot: "Footer", plugin: "@example/theme", theme: "broken" }],
    };
    const [page] = galleryDocuments(theme, islands);
    const results = await audit(page?.html ?? "");
    const failures = blocking(results);
    expect(failures.some((line) => line.startsWith("label (critical)"))).toBe(true);
    expect(failures.some((line) => line.startsWith("aria-hidden-focus (serious)"))).toBe(true);
  });

  it("finds no violation at all on an entity page whose map holds six nodes of every kind, nor on one whose map gives way to the pointer", async () => {
    const options = {
      theme: defaultTheme,
      locale: "en",
      title: "Model query",
      stylesheets: ["../assets/site.css"],
      islands,
      assetsBase: "../assets/",
      header: galleryFixtures.header,
      footer: galleryFixtures.footer,
    };
    const full = renderPage(
      "EntityPage",
      { ...galleryFixtures.entityPage, neighbours: galleryFixtures.neighbourhoodFull },
      options,
    );
    expect(full).toContain('<svg class="neighbourhood-graph"');
    expect(full).toContain('aria-hidden="true" focusable="false"');
    const results = await audit(full);
    expect(results.violations.map(describeViolation)).toEqual([]);
    const overflow = renderPage(
      "EntityPage",
      { ...galleryFixtures.entityPage, neighbours: galleryFixtures.neighbourhoodOverflow },
      options,
    );
    expect(overflow).toContain('<svg class="neighbourhood-graph"');
    expect(overflow).toContain(
      '<p class="neighbourhood-total">14 neighbours in total, more than the map shows.</p>',
    );
    expect((await audit(overflow)).violations.map(describeViolation)).toEqual([]);
    const empty = renderPage(
      "EntityPage",
      { ...galleryFixtures.entityPage, neighbours: { centre: "Entity page", neighbours: [] } },
      options,
    );
    expect(empty).toContain('<a href="#mentions-title">See the mentions panel</a>');
    expect((await audit(empty)).violations.map(describeViolation)).toEqual([]);
    // The pointer's target is on the same page.
    expect(document.getElementById("mentions-title")).not.toBeNull();
  });

  it("is run by the test step of the continuous integration workflow", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("pnpm test 2>&1 | tee test.log");
  });
});
