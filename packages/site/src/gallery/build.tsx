import { fileURLToPath } from "node:url";

import { h, type JSX } from "preact";

import type { FileSystem } from "@concordance-wiki/core";

import type { ContrastFinding } from "../a11y/contrast.js";
import type { BudgetReport } from "../budget.js";
import { assemblePages, assemblySummary, type PageReport } from "../build/assemble.js";
import { defaultIslands, type IslandBundle, type IslandEntry } from "../islands/bundle.js";
import { renderDocument, renderPage, type RenderOptions } from "../render.js";
import type { SlotProps } from "../slots.js";
import { chromeOf, type ThemeChrome } from "../theme/chrome.js";
import { AgeNotice } from "../theme/default/age-notice.js";
import { pageComponentFor } from "../theme/context.js";
import type { ResolvedTheme, ThemeOverride } from "../theme/types.js";
import { footer, galleryTheme, header } from "./fixtures.js";
import { GalleryIndex } from "./index-page.js";
import { withoutIslandScripts } from "./no-script.js";
import { galleryPages, type GalleryPage } from "./pages.js";
import { typePages, type GalleryTypes, type TypePage } from "./types.js";
import { GALLERY_WIDTH_ISLAND } from "./width-switch.js";

export const GALLERY_PAGE_BUDGET = 150_000;

const ASSETS_BASE = "assets/";

export interface GalleryOptions {
  /** Folder receiving the pages, the stylesheets and the island bundles under `assets/`. */
  output: string;
  /** The components, and the `theme.yaml` of the last theme when the loader found it: its name, logo, palette, stylesheet and credit then apply. */
  theme: ResolvedTheme;
  fileSystem: FileSystem;
  maxPageBytes?: number;
  /** The registered types, each rendered from its template through the generic page or its dedicated component; none without. */
  types?: GalleryTypes;
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
function rendered(page: GalleryPage, options: RenderOptions): string {
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

/** The document of a state; a state served without scripts loses those of its islands once rendered. */
function body(page: GalleryPage, options: RenderOptions): string {
  const html = rendered(page, options);
  return page.scripts === false ? withoutIslandScripts(html) : html;
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

/** The page of a type: its template through `EntityPage@<type>` when the theme resolved one, else through `EntityPage`. */
function typeBody(page: TypePage, options: RenderOptions): string {
  return renderDocument(h(pageComponentFor(options.theme, page.type), page.props), options);
}

/** The islands of the site, then the width switch of the index, which only the gallery bundles. */
export function galleryIslands(): IslandEntry[] {
  return [
    ...defaultIslands(),
    // No extension: the bundler picks the compiled module in a build and the source under test.
    {
      name: GALLERY_WIDTH_ISLAND,
      entry: fileURLToPath(new URL("./width.client", import.meta.url)),
    },
  ];
}

/** Every page of the gallery and its index, rendered through the theme against the given bundles. */
export function galleryDocuments(
  theme: ResolvedTheme,
  islands: IslandBundle[],
  types?: GalleryTypes,
): GalleryDocument[] {
  const chrome = theme.config === undefined ? undefined : chromeOf(theme.config, ASSETS_BASE);
  const suffix = chrome === undefined ? "" : ` – ${chrome.siteTitle}`;
  const options = (
    title: string,
    locale: string,
    page: FixtureChrome,
    scheme?: "dark",
  ): RenderOptions => ({
    theme,
    locale,
    title: `${title}${suffix}`,
    stylesheets: chrome?.stylesheets ?? [`${ASSETS_BASE}site.css`],
    ...(chrome?.favicon === undefined ? {} : { favicon: chrome.favicon }),
    islands,
    assetsBase: ASSETS_BASE,
    ...(scheme === undefined ? {} : { scheme }),
    ...chromeFor(page, chrome),
  });
  const documents = galleryPages.map((page) => ({
    path: page.file,
    html: body(page, {
      ...options(`${page.slot}, ${page.state}`, page.locale, page, page.scheme),
      ...(page.notice === undefined ? {} : { notice: h(AgeNotice, page.notice) }),
    }),
  }));
  const shownTypes = types === undefined ? [] : typePages(types, theme);
  for (const page of shownTypes) {
    documents.push({
      path: page.file,
      html: typeBody(page, options(`Type ${page.type}`, "en", { header, footer })),
    });
  }
  documents.push({
    path: "index.html",
    html: renderDocument(
      <GalleryIndex pages={galleryPages} types={shownTypes} overrides={theme.overrides} />,
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
    islands: galleryIslands(),
    documents: (islands) =>
      galleryDocuments(theme, islands, options.types).map(({ path, html }) => ({
        path,
        content: html,
      })),
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
