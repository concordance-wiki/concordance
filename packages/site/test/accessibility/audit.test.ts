import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { A11Y_RULES, checkAccessibility } from "../../src/a11y/check.js";
import { checkContrast } from "../../src/a11y/contrast.js";
import { buildGallery } from "../../src/gallery/build.js";
import { galleryTheme } from "../../src/gallery/fixtures.js";
import { galleryPages } from "../../src/gallery/pages.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { coreTypes, documents, states } from "./pages.js";

const here = fileURLToPath(new URL(".", import.meta.url));

describe("L9-08 audit on every gallery state", () => {
  it("lists every state file of the gallery in the page list, one page per file, named after it", () => {
    const files = readdirSync(resolve(here, "../../src/gallery/states"))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.replace(/\.ts$/, ".html"))
      .sort();
    const listed = galleryPages.map((page) => page.file);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(files);
    expect(states).toHaveLength(galleryPages.length);
  });

  it("renders one document per state, one per core type that ships a template, and the index", () => {
    const shown = coreTypes.modules.filter((module) => module.template !== undefined).length;
    expect(shown).toBeGreaterThan(10);
    expect(documents).toHaveLength(galleryPages.length + shown + 1);
    expect(documents.map((document) => document.path)).toContain("index.html");
  });

  it("passes the thirteen rules of the static checker on every document, the checker naming each failure by rule and message", () => {
    expect(A11Y_RULES).toHaveLength(13);
    for (const { path, html } of documents) {
      expect(checkAccessibility(html), path).toEqual([]);
    }
    expect(
      checkAccessibility("<html><body><main><h1>One</h1><h3>Three</h3></main></body></html>").map(
        (finding) => finding.rule,
      ),
    ).toEqual(["html-lang", "heading-order", "landmarks", "landmarks", "landmarks"]);
  });

  it("finds no pair of the gallery palette below its minimum", () => {
    expect(checkContrast(galleryTheme)).toEqual([]);
  });

  it("runs the automated audit over every state and the index, in the suite that loads a DOM, and fails on any violation", () => {
    const suite = readFileSync(resolve(here, "../a11y/axe.test.ts"), "utf8");
    // The environment directive is matched anywhere in a file: named here by its parts.
    expect(suite.split("\n")[0]).toBe(["//", "@vitest-environment", "happy-dom"].join(" "));
    expect(suite).toContain("galleryDocuments(defaultTheme, islands)");
    expect(suite).toContain("for (const { path, html } of documents) {");
    expect(suite).toContain("expect(results.violations.map(describeViolation)).toEqual([]);");
  });

  it("runs the checker and the contrast measure on every page the gallery command writes, and reports no problem", async () => {
    const fileSystem = memoryFileSystem();
    const report = await buildGallery({
      output: "/out",
      theme: defaultTheme,
      fileSystem,
      types: coreTypes,
    });
    expect(report.pages.map((page) => page.path).sort()).toEqual(
      documents.map((document) => document.path).sort(),
    );
    expect(report.pages.every((page) => page.findings.length === 0)).toBe(true);
    expect(report.problems).toEqual([]);
    expect(report.contrast).toEqual([]);
    expect(report.summary).toContain("accessibility: 0 findings");
    expect(report.summary).toContain("contrast: 0 pairs below the minimum");
  });
});
