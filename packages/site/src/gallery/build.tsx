import { h, type JSX } from "preact";

import type { FileSystem } from "@concordance-wiki/core";

import type { ContrastFinding } from "../a11y/contrast.js";
import type { BudgetReport } from "../budget.js";
import { assemblePages, assemblySummary, type PageReport } from "../build/assemble.js";
import type { IslandBundle } from "../islands/bundle.js";
import { renderDocument, renderPage, type RenderOptions } from "../render.js";
import type { SlotProps } from "../slots.js";
import { chromeOf, type ThemeChrome } from "../theme/chrome.js";
import type { ResolvedTheme, ThemeOverride } from "../theme/types.js";
import { footer, galleryTheme, header } from "./fixtures.js";
import { GalleryIndex } from "./index-page.js";
import { galleryPages, type GalleryPage } from "./pages.js";

export const GALLERY_PAGE_BUDGET = 150_000;

const ASSETS_BASE = "assets/";

export interface GalleryOptions {
  /** Folder receiving the pages, the stylesheets and the island bundles under `assets/`. */
  output: string;
  /** The components, and the `theme.yaml` of the last theme when the loader found it: its name, logo, palette, stylesheet and credit then apply. */
  theme: ResolvedTheme;
  fileSystem: FileSystem;
  maxPageBytes?: number;
}

export interface GalleryDocument {
  /** File name under the output folder. */
  path: string;
  html: string;
}

export type GalleryPageReport = PageReport;

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

interface FixtureChrome {
  header: SlotProps["Header"];
  footer: SlotProps["Footer"];
}

/** The fixture chrome, or the project's when the theme carries a `theme.yaml`: its name, logo and footer replace the fixtures'. */
function chromeFor(fixtures: FixtureChrome, chrome: ThemeChrome | undefined): FixtureChrome {
  if (chrome === undefined) {
    return fixtures;
  }
  const header: SlotProps["Header"] = { ...fixtures.header, siteTitle: chrome.siteTitle };
  delete header.logo;
  if (chrome.logo !== undefined) {
    header.logo = chrome.logo;
  }
  return { header, footer: { ...fixtures.footer, ...chrome.footer } };
}

/** Every page of the gallery and its index, rendered through the theme against the given bundles. */
export function galleryDocuments(theme: ResolvedTheme, islands: IslandBundle[]): GalleryDocument[] {
  const chrome = theme.config === undefined ? undefined : chromeOf(theme.config, ASSETS_BASE);
  const suffix = chrome === undefined ? "" : ` – ${chrome.siteTitle}`;
  const options = (title: string, locale: string, page: FixtureChrome): RenderOptions => ({
    theme,
    locale,
    title: `${title}${suffix}`,
    stylesheets: chrome?.stylesheets ?? [`${ASSETS_BASE}site.css`],
    ...(chrome?.favicon === undefined ? {} : { favicon: chrome.favicon }),
    islands,
    assetsBase: ASSETS_BASE,
    ...chromeFor(page, chrome),
  });
  const documents = galleryPages.map((page) => ({
    path: page.file,
    html: body(page, options(`${page.slot}, ${page.state}`, page.locale, page)),
  }));
  documents.push({
    path: "index.html",
    html: renderDocument(
      <GalleryIndex pages={galleryPages} overrides={theme.overrides} />,
      options("Component gallery", "en", { header, footer }),
    ),
  });
  return documents;
}

/** Writes every gallery page through the theme, measures them and checks their accessibility. */
export async function buildGallery(options: GalleryOptions): Promise<GalleryReport> {
  const { output, theme, fileSystem } = options;
  const assembled = await assemblePages({
    output,
    theme,
    fileSystem,
    // The palette checked for contrast is the one the stylesheet is written from.
    fallback: galleryTheme,
    maxPageBytes: options.maxPageBytes ?? GALLERY_PAGE_BUDGET,
    documents: (islands) =>
      galleryDocuments(theme, islands).map(({ path, html }) => ({ path, content: html })),
  });
  return {
    pages: assembled.pages,
    budget: assembled.budget,
    overrides: theme.overrides,
    contrast: assembled.contrast,
    summary: [
      `gallery: ${String(assembled.pages.length)} pages written to ${output}`,
      ...assemblySummary(assembled, theme),
    ],
    problems: assembled.problems,
  };
}
