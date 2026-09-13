import { h, type JSX } from "preact";

import type { FileSystem } from "@concordance-wiki/core";

import { checkAccessibility, type A11yFinding } from "../a11y/check.js";
import { checkContrast, type ContrastFinding } from "../a11y/contrast.js";
import { measureBudget, type BudgetReport, type PageSize } from "../budget.js";
import { siteStylesheet } from "../css/stylesheet.js";
import type { ThemeConfig } from "../css/theme-config.js";
import { bundleIslands, defaultIslands, type IslandBundle } from "../islands/bundle.js";
import { byCodeUnit } from "../order.js";
import { renderDocument, renderPage, type RenderOptions } from "../render.js";
import type { ResolvedTheme, ThemeOverride } from "../theme/types.js";
import { footer, galleryTheme, header } from "./fixtures.js";
import { GalleryIndex } from "./index-page.js";
import { galleryPages, type GalleryPage } from "./pages.js";

export const GALLERY_PAGE_BUDGET = 150_000;

export interface GalleryOptions {
  /** Folder receiving the pages, the stylesheet and the island bundles under `assets/`. */
  output: string;
  theme: ResolvedTheme;
  /** The palette of the stylesheet, checked for contrast; the neutral gallery palette by default. */
  tokens?: ThemeConfig;
  fileSystem: FileSystem;
  maxPageBytes?: number;
}

export interface GalleryDocument {
  /** File name under the output folder. */
  path: string;
  html: string;
}

export interface GalleryPageReport {
  /** File name under the output folder. */
  path: string;
  bytes: number;
  findings: A11yFinding[];
}

export interface GalleryReport {
  /** Every page written, the index included, sorted by path. */
  pages: GalleryPageReport[];
  budget: BudgetReport;
  overrides: ThemeOverride[];
  /** The pairs of the palette below their minimum ratio; reported in the summary, never a problem. */
  contrast: ContrastFinding[];
  /** Lines describing what was written. */
  summary: string[];
  /** One line per page over budget or accessibility finding; empty when the gallery passes. */
  problems: string[];
}

const STYLESHEET = "assets/site.css";

function framed(page: GalleryPage, panel: JSX.Element, options: RenderOptions): string {
  const document: JSX.Element = (
    <div class="gallery-panel">
      <h1>
        {page.slot}, {page.state}
      </h1>
      {panel}
    </div>
  );
  return renderDocument(document, options);
}

/** A page slot renders as on the site; a panel has no title of its own, so the gallery frames it under one. */
function body(page: GalleryPage, options: RenderOptions): string {
  const { components } = options.theme;
  switch (page.rendered) {
    case "MentionsPanel":
      return framed(page, h(components.MentionsPanel, page.props), options);
    case "Neighbourhood":
      return framed(page, h(components.Neighbourhood, page.props), options);
    default:
      return renderPage(page.rendered, page.props, options);
  }
}

function problemsOf(pages: GalleryPageReport[], budget: BudgetReport): string[] {
  return [
    ...budget.overBudget.map((page) => `${page.path}: over budget`),
    ...pages.flatMap((page) =>
      page.findings.map((finding) => `${page.path}: ${finding.rule}: ${finding.message}`),
    ),
  ];
}

/** Every page of the gallery and its index, rendered through the theme against the given bundles. */
export function galleryDocuments(theme: ResolvedTheme, islands: IslandBundle[]): GalleryDocument[] {
  const render = (page: GalleryPage): RenderOptions => ({
    theme,
    locale: page.locale,
    title: `${page.slot}, ${page.state}`,
    stylesheets: [STYLESHEET],
    islands,
    assetsBase: "assets/",
    header: page.header,
    footer: page.footer,
  });
  const documents = galleryPages.map((page) => ({
    path: page.file,
    html: body(page, render(page)),
  }));
  documents.push({
    path: "index.html",
    html: renderDocument(<GalleryIndex pages={galleryPages} overrides={theme.overrides} />, {
      theme,
      locale: "en",
      title: "Component gallery",
      stylesheets: [STYLESHEET],
      islands,
      assetsBase: "assets/",
      header,
      footer,
    }),
  });
  return documents;
}

/** Writes every gallery page through the theme, measures them and checks their accessibility. */
export async function buildGallery(options: GalleryOptions): Promise<GalleryReport> {
  const { output, theme, fileSystem } = options;
  const tokens = options.tokens ?? galleryTheme;
  const islands = await bundleIslands({
    outDir: `${output}/assets`,
    islands: defaultIslands(),
    fileSystem,
  });
  fileSystem.writeText(`${output}/${STYLESHEET}`, siteStylesheet({ theme: tokens }));
  const documents = galleryDocuments(theme, islands);
  const pages: GalleryPageReport[] = [];
  for (const { path, html } of documents) {
    fileSystem.writeText(`${output}/${path}`, html);
    pages.push({ path, bytes: Buffer.byteLength(html), findings: checkAccessibility(html) });
  }
  pages.sort((a, b) => byCodeUnit(a.path, b.path));
  const sizes: PageSize[] = pages.map(({ path, bytes }) => ({ path, bytes }));
  const budget = measureBudget(sizes, islands, {
    maxPageBytes: options.maxPageBytes ?? GALLERY_PAGE_BUDGET,
  });
  const findings = pages.reduce((total, page) => total + page.findings.length, 0);
  const contrast = checkContrast(tokens);
  return {
    pages,
    budget,
    overrides: theme.overrides,
    contrast,
    summary: [
      `gallery: ${String(pages.length)} pages written to ${output}`,
      ...theme.overrides.map(
        (override) =>
          `override ${override.slot}: plugin ${override.plugin}, theme ${override.theme}`,
      ),
      ...budget.summary,
      `accessibility: ${String(findings)} findings`,
      `contrast: ${String(contrast.length)} pairs below the minimum`,
      ...contrast.map((finding) => `warning: contrast: ${finding.message}`),
    ],
    problems: problemsOf(pages, budget),
  };
}
