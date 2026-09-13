// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "disableJavaScriptEvaluation": true, "handleDisabledFileLoadingAsSuccess": true } }
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import axe, { type AxeResults, type ImpactValue, type Result } from "axe-core";
import { h, type JSX } from "preact";
import { describe, expect, it } from "vitest";

import { galleryDocuments, type GalleryDocument } from "../../src/gallery/build.js";
import { defaultComponents } from "../../src/theme/default/index.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");

/** The audit stops the build on these impacts; minor and moderate ones are reported, not blocking. */
const BLOCKING: ReadonlySet<ImpactValue> = new Set(["serious", "critical"]);

/**
 * Rules that need a layout engine, which no DOM implementation provides: the palette is checked
 * by the contrast test instead, over the pairs the stylesheet declares.
 */
const NEEDS_LAYOUT = ["color-contrast", "color-contrast-enhanced", "link-in-text-block"];

const islands = [
  { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
  { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
];

/** Loads a rendered page into the test document, root attributes included, so that axe sees the page as served. */
function load(html: string): void {
  const source = new DOMParser().parseFromString(html, "text/html").documentElement;
  const target = document.documentElement;
  for (const { name } of [...target.attributes]) target.removeAttribute(name);
  for (const { name, value } of [...source.attributes]) target.setAttribute(name, value);
  target.innerHTML = source.innerHTML;
}

async function audit(html: string): Promise<AxeResults> {
  load(html);
  return axe.run(document, {
    resultTypes: ["violations"],
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

  it("is run by the test step of the continuous integration workflow", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("run: pnpm test");
  });
});
