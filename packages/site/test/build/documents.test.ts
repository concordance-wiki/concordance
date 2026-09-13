import { memoryFileSystem, pagePath } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { beforeAll, describe, expect, it } from "vitest";

import { siteContext } from "../../src/build/context.js";
import { documentsOf, entityPageOf } from "../../src/build/entity-page.js";
import type { EntityFragment } from "../../src/build/fragments.js";
import {
  buildSite,
  needsViewer,
  siteDocuments,
  viewerBundlesOf,
  type SiteOptions,
  type SiteReport,
} from "../../src/build/site.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { count } from "../helpers/html.js";
import { localTargets, references } from "../helpers/links.js";
import { fragments, model, profile, screen, tokenize } from "./fixture.js";

/** The screen of the fixture, whose deck was converted and whose transcript was read. */
const withDocuments = new Map<string, EntityFragment>([
  ...fragments,
  [
    screen.id,
    {
      id: screen.id,
      sections: [{ id: "lead", html: "<p>The panel.</p>" }],
      text: "The panel.\nKeyword page threshold\nBuild summary",
      documents: [
        {
          source: "specs",
          path: "screens/mentions-panel.pptx",
          format: "pptx",
          target: `${screen.id}/screens/mentions-panel.pptx`,
          preview: `${screen.id}/screens/mentions-panel.pdf`,
          unit: "slide",
          pages: [
            { number: 1, label: "slide 1", text: "Keyword page threshold" },
            { number: 2, label: "slide 2", text: "Build summary" },
          ],
        },
        {
          source: "specs",
          path: "screens/mentions-panel.vtt",
          format: "vtt",
          target: `${screen.id}/screens/mentions-panel.vtt`,
          unit: "cue",
          pages: [
            { number: 1, label: "00:00:04", text: "The mentions panel.", speaker: "Participant-1" },
          ],
        },
      ],
    },
  ],
]);

function options(
  overrides: Partial<Omit<SiteOptions, "fileSystem">> = {},
): SiteOptions & { fileSystem: ReturnType<typeof memoryFileSystem> } {
  return {
    output: "/dist",
    fileSystem: memoryFileSystem(),
    model: model(),
    fragments: withDocuments,
    profile,
    theme: defaultTheme,
    locale: "en",
    projectName: "Concordance notes",
    tokenize,
    ...overrides,
  };
}

const page = pagePath(screen.id);

describe("A document page: download link, viewer on demand, extracted text", () => {
  let fileSystem: ReturnType<typeof memoryFileSystem>;
  let report: SiteReport;
  let html: string;

  beforeAll(async () => {
    const site = options();
    report = await buildSite(site);
    fileSystem = site.fileSystem;
    html = fileSystem.readText(`/dist/${page}`);
  });

  it("builds the viewer and its worker as separate bundles, announced in the summary with their size, and never loads them with the page", () => {
    const names = report.budget.islands.map((island) => island.name);
    expect(names).toEqual([
      "category-list",
      "contract-viewer",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "search",
      "trail",
      "viewer-pdf",
      "viewer-pdf-worker",
    ]);
    const viewer = report.budget.islands.find((island) => island.name === "viewer-pdf");
    const worker = report.budget.islands.find((island) => island.name === "viewer-pdf-worker");
    const opener = report.budget.islands.find((island) => island.name === "document-viewer");
    expect(viewer?.bytes).toBeGreaterThan(300_000);
    expect(worker?.bytes).toBeGreaterThan(1_000_000);
    expect(opener?.bytes).toBeLessThan(3_000);
    expect(report.summary.filter((line) => line.startsWith("island "))).toHaveLength(9);
    // The page loads the opener as any island; the viewer bundles are only named in its props.
    const loaded = references(html).filter((reference) => reference.includes("/assets/"));
    expect(loaded.filter((reference) => reference.includes("document-viewer-"))).toHaveLength(2);
    expect(loaded.some((reference) => reference.includes("viewer-pdf"))).toBe(false);
    expect(html).toContain(
      `&quot;viewerHref&quot;:&quot;../../../assets/${viewer?.file ?? ""}&quot;`,
    );
    expect(html).toContain(
      `&quot;workerHref&quot;:&quot;../../../assets/${worker?.file ?? ""}&quot;`,
    );
    expect(fileSystem.exists(`/dist/assets/${viewer?.file ?? ""}`)).toBe(true);
    expect(fileSystem.exists(`/dist/assets/${worker?.file ?? ""}`)).toBe(true);
    // Both bundles are modules that pdf.js can run in a browser: the viewer exports its opener.
    const bundle = fileSystem.readText(`/dist/assets/${viewer?.file ?? ""}`);
    expect(bundle).toContain("openViewer");
    expect(bundle).toContain("workerSrc");
  });

  it("keeps every other page free of the viewer, and the initial bundles unchanged", () => {
    const other = fileSystem.readText(`/dist/${pagePath("glossary/keyword-page")}`);
    expect(other).not.toContain("viewer-pdf");
    expect(other).not.toContain("document-viewer-");
    expect(count(html, 'data-island="document-viewer"')).toBe(1);
  });

  it("links the original file for download and the PDF to open, both relative to the page, at the paths render places them", () => {
    expect(html).toContain(
      '<a class="document-download" href="screens/mentions-panel.pptx" download="mentions-panel.pptx">Download mentions-panel.pptx</a>',
    );
    expect(html).toContain(
      '<a class="document-pdf" href="screens/mentions-panel.pdf">Open the PDF</a>',
    );
    expect(html).toContain(
      '<a class="document-download" href="screens/mentions-panel.vtt" download="mentions-panel.vtt">Download mentions-panel.vtt</a>',
    );
    const targets = localTargets(page, html).map((target) => target.target);
    expect(targets).toContain(`${screen.id}/screens/mentions-panel.pptx`);
    expect(targets).toContain(`${screen.id}/screens/mentions-panel.pdf`);
    expect(targets).toContain(`${screen.id}/screens/mentions-panel.vtt`);
  });

  it("serves the extracted text of every position and the rail without JavaScript", () => {
    const still = html
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(
        /<concordance-island data-island="document-viewer"[\s\S]*?<\/concordance-island>/g,
        "",
      );
    expect(still).toContain(
      '<details id="L1" open><summary>slide 1</summary><p>Keyword page threshold</p></details>',
    );
    expect(still).toContain(
      '<details id="L2"><summary>slide 2</summary><p>Build summary</p></details>',
    );
    expect(still).toContain("<summary>00:00:04</summary><p>The mentions panel.</p>");
    expect(still).toContain('<nav class="document-rail" aria-label="Slides">');
    expect(still).toContain('class="document-download"');
    expect(still).not.toContain("Open the viewer");
  });

  it("passes the accessibility checks and stays under the page budget", () => {
    expect(report.warnings).toEqual([]);
    expect(report.budget.overBudget).toEqual([]);
  });
});

describe("The viewer bundles are built only for a site with a PDF to show", () => {
  it("bundles the default islands alone when no fragment carries a preview", async () => {
    const withoutPreview = new Map(withDocuments);
    const fragment = withoutPreview.get(screen.id) as EntityFragment;
    withoutPreview.set(screen.id, {
      ...fragment,
      documents: (fragment.documents ?? []).map((document) => {
        const { preview, ...rest } = document;
        expect(preview === undefined || typeof preview === "string").toBe(true);
        return rest;
      }),
    });
    const site = options({ fragments: withoutPreview });
    const report = await buildSite(site);
    expect(report.budget.islands.map((island) => island.name)).toEqual([
      "category-list",
      "contract-viewer",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "search",
      "trail",
    ]);
    const html = site.fileSystem.readText(`/dist/${page}`);
    expect(html).not.toContain('data-island="document-viewer"');
    expect(html).toContain('class="document-download"');
    expect(html).not.toContain('class="document-pdf"');
    expect(needsViewer(withoutPreview)).toBe(false);
    expect(needsViewer(withDocuments)).toBe(true);
    expect(needsViewer(fragments)).toBe(false);
  });

  it("offers the PDF link without the opener when the bundles were not built, whatever the reason", () => {
    const { documents } = siteDocuments(options(), [
      { name: "document-viewer", file: "document-viewer-00000000.js", bytes: 1 },
      { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 1 },
      { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 1 },
      { name: "search", file: "search-00000000.js", bytes: 1 },
      { name: "trail", file: "trail-00000000.js", bytes: 1 },
    ]);
    const html = documents.find((document) => document.path === page)?.content ?? "";
    expect(html).toContain('class="document-pdf"');
    expect(html).not.toContain('data-island="document-viewer"');
    expect(viewerBundlesOf([])).toBeUndefined();
    expect(
      viewerBundlesOf([{ name: "viewer-pdf", file: "viewer-pdf-A.js", bytes: 1 }]),
    ).toBeUndefined();
    expect(
      viewerBundlesOf([
        { name: "viewer-pdf-worker", file: "viewer-pdf-worker-B.js", bytes: 1 },
        { name: "viewer-pdf", file: "viewer-pdf-A.js", bytes: 1 },
      ]),
    ).toEqual({ viewer: "assets/viewer-pdf-A.js", worker: "assets/viewer-pdf-worker-B.js" });
  });
});

describe("documentsOf", () => {
  const context = siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments: withDocuments,
  });

  it("turns the documents of the fragment into the view model of the page, hrefs relative to it", () => {
    expect(
      documentsOf(context, page, screen, {
        viewer: "assets/viewer-pdf-A.js",
        worker: "assets/viewer-pdf-worker-B.js",
      }),
    ).toEqual([
      {
        file: { label: "mentions-panel.pptx", href: "screens/mentions-panel.pptx", format: "pptx" },
        preview: {
          href: "screens/mentions-panel.pdf",
          viewerHref: "../../../assets/viewer-pdf-A.js",
          workerHref: "../../../assets/viewer-pdf-worker-B.js",
        },
        unit: "slide",
        positions: [
          { number: 1, label: "slide 1", text: "Keyword page threshold" },
          { number: 2, label: "slide 2", text: "Build summary" },
        ],
      },
      {
        file: { label: "mentions-panel.vtt", href: "screens/mentions-panel.vtt", format: "vtt" },
        unit: "cue",
        positions: [
          { number: 1, label: "00:00:04", text: "The mentions panel.", speaker: "Participant-1" },
        ],
      },
    ]);
    expect(documentsOf(context, page, screen)[0]?.preview).toEqual({
      href: "screens/mentions-panel.pdf",
    });
  });

  it("gives an entity without a document, or without a fragment, no documents on its page", () => {
    const term = model().entities.find((entity) => entity.id === "glossary/keyword-page");
    if (term === undefined) throw new Error("the fixture has the term");
    expect(documentsOf(context, pagePath(term.id), term)).toEqual([]);
    expect(entityPageOf(context, term)).not.toHaveProperty("documents");
    expect(entityPageOf(context, screen).documents).toHaveLength(2);
    const orphan = { ...term, id: "glossary/no-fragment" };
    expect(documentsOf(context, pagePath(orphan.id), orphan)).toEqual([]);
  });
});
