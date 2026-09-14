import { describe, expect, it } from "vitest";

import { INDEX_PAGE } from "../../src/build/paths.js";
import { SITE_PAGE_BUDGET, siteDocuments, type SiteInput } from "../../src/build/site.js";
import type { IslandBundle } from "../../src/islands/bundle.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { localTargets } from "../helpers/links.js";
import { entity, fragments, model, profile, tokenize } from "./fixture.js";

const bundles: IslandBundle[] = [
  { name: "mentions-panel", file: "mentions-panel-ABC123.js", bytes: 1 },
  { name: "mode-switch", file: "mode-switch-DEF456.js", bytes: 1 },
  { name: "search", file: "search-0123ABCD.js", bytes: 1 },
  { name: "toc", file: "toc-789ABC.js", bytes: 1 },
  { name: "panels", file: "panels-789ABC.js", bytes: 1 },
  { name: "trail", file: "trail-789ABC.js", bytes: 1 },
];

const subjects = [
  "alias",
  "build log",
  "candidate expression",
  "dictionary",
  "explicit link",
  "finding",
  "glossary",
  "homonym",
  "identifier",
  "keyword page",
  "language pack",
  "mention",
  "neighbourhood",
  "occurrence",
  "provenance",
  "remediation",
  "source",
  "theme",
  "twin resources",
  "white label",
  "zone",
  "étude",
  "42 checks",
];

/** A corpus the size of a real knowledge base: 3000 notes about the tool, spread over the letters. */
function corpus(): SiteInput {
  const entities = Array.from({ length: 3000 }, (_, index) => {
    const subject = subjects[index % subjects.length] ?? "note";
    const number = String(index).padStart(4, "0");
    return entity({
      id: `specs/notes/${number}`,
      type: index % 7 === 0 ? "screen" : "term",
      title: `${subject} of the pipeline, note ${number} of the golden corpus`,
    });
  });
  return {
    model: model({ entities, links: [], findings: [] }),
    fragments,
    profile,
    theme: defaultTheme,
    locale: "en",
    projectName: "Concordance notes",
    tokenize,
  };
}

describe("The alphabetical index of a realistic corpus is segmented to stay under the page weight budget", () => {
  const { documents } = siteDocuments(corpus(), bundles);
  const indexPages = documents.filter((document) => document.path.startsWith("index/"));
  const written = new Set(documents.map((document) => document.path));

  it("writes one page per letter with entries, the index address first, every one under the budget", () => {
    expect(indexPages.map((page) => page.path)).toEqual([
      INDEX_PAGE,
      "index/a/index.html",
      "index/b/index.html",
      "index/c/index.html",
      "index/d/index.html",
      "index/e/index.html",
      "index/f/index.html",
      "index/g/index.html",
      "index/h/index.html",
      "index/i/index.html",
      "index/k/index.html",
      "index/l/index.html",
      "index/m/index.html",
      "index/n/index.html",
      "index/o/index.html",
      "index/p/index.html",
      "index/r/index.html",
      "index/s/index.html",
      "index/t/index.html",
      "index/w/index.html",
      "index/z/index.html",
      "index/other/index.html",
    ]);
    for (const page of indexPages) {
      expect(Buffer.byteLength(page.content), page.path).toBeLessThan(SITE_PAGE_BUDGET);
    }
    const whole = documents.reduce(
      (total, document) =>
        document.path.startsWith("index/") ? total + Buffer.byteLength(document.content) : total,
      0,
    );
    expect(whole).toBeGreaterThan(100_000);
  });

  it("links every letter page to its siblings and every link of an index page to a written page", () => {
    for (const page of indexPages) {
      const siblings = indexPages.filter((other) => other.path !== page.path);
      for (const sibling of siblings.filter((other) => other.path !== INDEX_PAGE)) {
        const target = localTargets(page.path, page.content).find(
          (link) => link.target === sibling.path,
        );
        expect(target, `${page.path} links ${sibling.path}`).toBeDefined();
      }
      // The assets are written by the assembly, outside the documents.
      const pages = localTargets(page.path, page.content).filter(
        ({ target }) => !target.startsWith("assets/"),
      );
      expect(pages.length).toBeGreaterThan(100);
      for (const { reference, target } of pages) {
        expect(written.has(target), `${page.path}: ${reference} resolves to ${target}`).toBe(true);
      }
      expect(page.content).toContain('<span class="letter inactive" aria-disabled="true">J</span>');
      expect(page.content).toContain('aria-current="page"');
    }
    // The letters live on the index page alone; the home page leads to it through the top bar.
    const home = documents.find((document) => document.path === "index.html");
    expect(home?.content).toContain('<a href="index/index.html">A–Z index</a>');
    expect(home?.content).not.toContain('href="index/e/index.html"');
  });

  it("titles a letter page after the index and its letter", () => {
    expect(indexPages[1]?.content).toContain("<title>Index A – Concordance notes</title>");
    expect(indexPages[0]?.content).toContain("<title>Index A – Concordance notes</title>");
  });
});
