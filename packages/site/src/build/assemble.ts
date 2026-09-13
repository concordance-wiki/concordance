import type { FileSystem } from "@concordance-wiki/core";

import { checkAccessibility, type A11yFinding } from "../a11y/check.js";
import { checkContrast, type ContrastFinding } from "../a11y/contrast.js";
import { measureBudget, type BudgetReport, type PageSize } from "../budget.js";
import type { ThemeConfig } from "../css/theme-config.js";
import {
  bundleIslands,
  defaultIslands,
  type IslandBundle,
  type IslandEntry,
} from "../islands/bundle.js";
import { byCodeUnit } from "../order.js";
import { writeThemeAssets } from "../theme/chrome.js";
import type { ResolvedTheme } from "../theme/types.js";
import { ASSETS_DIRECTORY } from "./paths.js";

/** One file of the output folder: a page, or any other text the site ships. */
export interface WrittenDocument {
  /** Path under the output folder. */
  path: string;
  content: string;
  /** A former keyword address forwarding to the note that took the expression over. */
  kind?: "redirect";
}

export interface PageReport {
  /** Path under the output folder. */
  path: string;
  bytes: number;
  findings: A11yFinding[];
}

export interface AssembleOptions {
  output: string;
  theme: ResolvedTheme;
  fileSystem: FileSystem;
  /** The palette the stylesheet is written from when the theme carries no `theme.yaml`. */
  fallback: ThemeConfig;
  maxPageBytes: number;
  /** The islands to bundle; those of the default theme when absent. */
  islands?: IslandEntry[];
  /** Every document to write, once the island bundles are known. */
  documents: (islands: IslandBundle[]) => WrittenDocument[];
}

export interface Assembled {
  /** Every HTML page written, sorted by path, with its size and its accessibility findings. */
  pages: PageReport[];
  budget: BudgetReport;
  /** The pairs of the palette below their minimum ratio; reported, never a failure. */
  contrast: ContrastFinding[];
  islands: IslandBundle[];
  /** Every file written under the output folder, sorted. */
  files: string[];
  /** One line per page over budget or accessibility finding. */
  problems: string[];
}

/**
 * What a gallery and a site share: the island bundles and the theme files under `assets/`, the
 * documents written, every page measured against the budget and checked for accessibility.
 */
export async function assemblePages(options: AssembleOptions): Promise<Assembled> {
  const { output, theme, fileSystem } = options;
  const assets = `${output}/${ASSETS_DIRECTORY}`;
  const islands = await bundleIslands({
    outDir: assets,
    islands: options.islands ?? defaultIslands(),
    fileSystem,
  });
  const source = theme.config ?? { config: options.fallback, assets: [], fileSystem };
  const files = [
    ...islands.map((island) => `${ASSETS_DIRECTORY}/${island.file}`),
    ...writeThemeAssets(source, fileSystem, assets).map((file) => `${ASSETS_DIRECTORY}/${file}`),
  ];
  const pages: PageReport[] = [];
  for (const { path, content } of options.documents(islands)) {
    fileSystem.writeText(`${output}/${path}`, content);
    files.push(path);
    if (path.endsWith(".html")) {
      pages.push({
        path,
        bytes: Buffer.byteLength(content),
        findings: checkAccessibility(content),
      });
    }
  }
  pages.sort((a, b) => byCodeUnit(a.path, b.path));
  const sizes: PageSize[] = pages.map(({ path, bytes }) => ({ path, bytes }));
  const budget = measureBudget(sizes, islands, { maxPageBytes: options.maxPageBytes });
  return {
    pages,
    budget,
    contrast: checkContrast(source.config),
    islands,
    files: files.sort(byCodeUnit),
    problems: [
      ...budget.overBudget.map((page) => `${page.path}: over budget`),
      ...pages.flatMap((page) =>
        page.findings.map((finding) => `${page.path}: ${finding.rule}: ${finding.message}`),
      ),
    ],
  };
}

/** The lines every summary shares: the theme in use, the overrides, the budget, the accessibility and contrast counts. */
export function assemblySummary(assembled: Assembled, theme: ResolvedTheme): string[] {
  const findings = assembled.pages.reduce((total, page) => total + page.findings.length, 0);
  return [
    ...(theme.config === undefined
      ? []
      : [`theme: ${theme.config.config.name}, from ${theme.config.file}`]),
    ...theme.overrides.map(
      (override) => `override ${override.slot}: plugin ${override.plugin}, theme ${override.theme}`,
    ),
    ...assembled.budget.summary,
    `accessibility: ${String(findings)} findings`,
    `contrast: ${String(assembled.contrast.length)} pairs below the minimum`,
    ...assembled.contrast.map((finding) => `warning: contrast: ${finding.message}`),
  ];
}
